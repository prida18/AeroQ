import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Play, Pause, RotateCcw, Compass, Plane } from 'lucide-react';
import type { RouteCandidate, CorridorPoint, LiveFlight, WeatherInfo } from '../types';
import { fetchLiveWeather, fetchLiveAirTraffic } from '../services/liveDataService';

interface MapTilerGlobeProps {
  candidates: RouteCandidate[];
  optimalRouteIndex: number;
  depCoord: [number, number]; // [lat, lng]
  destCoord: [number, number]; // [lat, lng]
  depCode: string;
  destCode: string;
  corridorPoints?: CorridorPoint[];
  className?: string;
}

export const MapTilerGlobe: React.FC<MapTilerGlobeProps> = ({
  candidates,
  optimalRouteIndex,
  depCoord,
  destCoord,
  depCode,
  destCode,
  corridorPoints = [],
  className = '',
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const planeMeshRef = useRef<any>(null);
  const pointMarkersRef = useRef<any[]>([]);
  const cloudMarkersRef = useRef<any[]>([]);
  const liveFlightsRef = useRef<LiveFlight[]>([]);
  const flightMarkersMapRef = useRef<Map<string, { marker: any; iconWrap: HTMLElement }>>(new Map());

  const [isPlaying, setIsPlaying] = useState(true);
  const [followPlane, setFollowPlane] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);

  // Client-side live data state
  const [clientFlights, setClientFlights] = useState<LiveFlight[]>([]);
  const [clientWeatherMap, setClientWeatherMap] = useState<Record<string, WeatherInfo>>({});

  // Extract selected optimal route path coordinates [lng, lat]
  const optimalRoute = candidates[optimalRouteIndex] || candidates[0];
  const pathPoints: [number, number][] = optimalRoute?.coordinates || [
    [depCoord[1], depCoord[0]],
    [destCoord[1], destCoord[0]],
  ];

  const loadClientLiveDataRef = useRef<((forceRefetch?: boolean) => void) | null>(null);

  // Client-side live data fetcher (Air traffic & Weather)
  useEffect(() => {
    let isCancelled = false;

    const loadClientLiveData = async (forceRefetch = false) => {
      try {
        // 1. Fetch live air traffic directly in the frontend
        const flights = await fetchLiveAirTraffic(
          depCoord[0],
          depCoord[1],
          destCoord[0],
          destCoord[1],
          forceRefetch
        );
        if (!isCancelled) {
          setClientFlights(flights);
        }

        // 2. Fetch live weather directly for Departure & Destination
        const [depWx, destWx] = await Promise.all([
          fetchLiveWeather(depCoord[0], depCoord[1]),
          fetchLiveWeather(destCoord[0], destCoord[1]),
        ]);

        const wxMap: Record<string, WeatherInfo> = {
          [depCode]: depWx,
          [destCode]: destWx,
        };

        // 3. Fetch live weather for intermediate corridor points
        if (corridorPoints.length > 0) {
          await Promise.all(
            corridorPoints.map(async (pt) => {
              if (pt.id !== depCode && pt.id !== destCode) {
                const wx = await fetchLiveWeather(pt.latitude, pt.longitude);
                wxMap[pt.id] = wx;
              }
            })
          );
        }

        if (!isCancelled) {
          setClientWeatherMap(wxMap);
        }
      } catch (err) {
        console.warn('Client-side live data fetch error:', err);
      }
    };

    loadClientLiveDataRef.current = loadClientLiveData;
    loadClientLiveData();

    return () => {
      isCancelled = true;
    };
  }, [depCoord, destCoord, depCode, destCode, corridorPoints]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainer.current) return;

    const maplibregl = (window as any).maplibregl || (window as any).maptilersdk;
    if (!maplibregl || !maplibregl.Map) {
      console.warn('MapLibre / MapTiler SDK JS not loaded yet');
      return;
    }

    // CARTO Dark Matter map style
    const cartoDarkStyle: any = {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4efc_1_40e62213b473be5343c10806',
            'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4efc_1_40e62213b473be5343c10806',
            'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4efc_1_40e62213b473be5343c10806',
            'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4efc_1_40e62213b473be5343c10806',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: cartoDarkStyle,
      center: [depCoord[1], depCoord[0]],
      zoom: 4.8,
      pitch: 50,
      bearing: 0,
    });

    if (map.setProjection) {
      map.setProjection({ type: 'globe' });
    }

    mapInstance.current = map;

    // Resize observer to keep canvas perfectly synced with full-screen container
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    map.on('load', () => {
      setIsMapReady(true);
      if (map.setFog) {
        map.setFog({
          color: 'rgba(10, 15, 30, 0.9)',
          'high-color': 'rgba(20, 30, 60, 0.8)',
          'space-color': 'rgba(5, 8, 18, 1)',
          'horizon-blend': 0.1,
        });
      }

      // Add candidate route polylines (clean colors, no glow)
      candidates.forEach((cand, idx) => {
        const isOpt = idx === optimalRouteIndex;
        const lineId = `route-line-${idx}`;

        const geojson: any = {
          type: 'Feature',
          properties: { isOptimal: isOpt },
          geometry: {
            type: 'LineString',
            coordinates: cand.coordinates,
          },
        };

        if (map.getSource(lineId)) {
          map.getSource(lineId).setData(geojson);
        } else {
          map.addSource(lineId, {
            type: 'geojson',
            data: geojson,
          });

          map.addLayer({
            id: lineId,
            type: 'line',
            source: lineId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isOpt ? '#3b82f6' : '#64748b',
              'line-width': isOpt ? 4 : 2,
              'line-opacity': isOpt ? 0.95 : 0.4,
              'line-dasharray': isOpt ? [1] : [2, 2],
            },
          });
        }
      });

      // Custom 3D Airplane Layer with Three.js
      const customLayer: any = {
        id: 'airplane-3d-model',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (_map: any, gl: WebGLRenderingContext) {
          this.camera = new (THREE as any).Camera();
          this.scene = new (THREE as any).Scene();

          const planeGroup = new (THREE as any).Group();

          // Procedural Jet Airplane Geometry
          const fuselageGeo = new (THREE as any).CylinderGeometry(14, 6, 160, 16);
          fuselageGeo.rotateX(Math.PI / 2);
          const fuselageMat = new (THREE as any).MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.85,
            roughness: 0.15,
          });
          const fuselage = new (THREE as any).Mesh(fuselageGeo, fuselageMat);
          planeGroup.add(fuselage);

          // Cockpit glass
          const cockpitGeo = new (THREE as any).SphereGeometry(12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
          const cockpitMat = new (THREE as any).MeshStandardMaterial({
            color: 0x0284c7,
            metalness: 0.9,
            roughness: 0.1,
          });
          const cockpit = new (THREE as any).Mesh(cockpitGeo, cockpitMat);
          cockpit.position.set(0, 4, 60);
          cockpit.scale.set(0.9, 0.6, 1.2);
          planeGroup.add(cockpit);

          // Wings
          const wingGeo = new (THREE as any).BoxGeometry(190, 3, 38);
          const wingMat = new (THREE as any).MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.7,
            roughness: 0.3,
          });
          const wings = new (THREE as any).Mesh(wingGeo, wingMat);
          wings.position.set(0, 0, 10);
          planeGroup.add(wings);

          // Wingtip lights
          const tipLeftMat = new (THREE as any).MeshBasicMaterial({ color: 0xef4444 });
          const tipLeft = new (THREE as any).Mesh(new (THREE as any).BoxGeometry(4, 8, 8), tipLeftMat);
          tipLeft.position.set(95, 3, 10);

          const tipRightMat = new (THREE as any).MeshBasicMaterial({ color: 0x22c55e });
          const tipRight = new (THREE as any).Mesh(new (THREE as any).BoxGeometry(4, 8, 8), tipRightMat);
          tipRight.position.set(-95, 3, 10);

          planeGroup.add(tipLeft);
          planeGroup.add(tipRight);

          // Tail fin
          const tailGeo = new (THREE as any).BoxGeometry(4, 45, 30);
          const tailMat = new (THREE as any).MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6 });
          const tail = new (THREE as any).Mesh(tailGeo, tailMat);
          tail.position.set(0, 25, -65);
          tail.rotation.x = -Math.PI / 6;
          planeGroup.add(tail);

          this.scene.add(planeGroup);
          planeMeshRef.current = planeGroup;

          const loader = new GLTFLoader();
          loader.load(
            '/models/airplane.glb',
            (gltf: any) => {
              const model = gltf.scene;
              const box = new (THREE as any).Box3().setFromObject(model);
              const center = box.getCenter(new (THREE as any).Vector3());
              const size = box.getSize(new (THREE as any).Vector3());

              model.position.sub(center);
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) {
                const scaleFactor = 180 / maxDim;
                model.scale.set(scaleFactor, scaleFactor, scaleFactor);
              }

              while (planeGroup.children.length > 0) {
                planeGroup.remove(planeGroup.children[0]);
              }
              planeGroup.add(model);
            },
            undefined,
            () => {}
          );

          // Lighting
          const ambientLight = new (THREE as any).AmbientLight(0xffffff, 2.0);
          this.scene.add(ambientLight);

          const dirLight = new (THREE as any).DirectionalLight(0xffffff, 3.0);
          dirLight.position.set(500, 500, 500);
          this.scene.add(dirLight);

          const hemiLight = new (THREE as any).HemisphereLight(0xffffff, 0x080820, 1.5);
          this.scene.add(hemiLight);

          this.renderer = new (THREE as any).WebGLRenderer({
            canvas: _map.getCanvas(),
            context: gl,
            antialiasing: true,
          });
          this.renderer.autoClear = false;
        },
        render: function (_gl: WebGLRenderingContext, matrix: number[]) {
          const m = new (THREE as any).Matrix4().fromArray(matrix);
          this.camera.projectionMatrix = m;
          this.renderer.resetState();
          this.renderer.render(this.scene, this.camera);
          if (mapInstance.current) {
            mapInstance.current.triggerRepaint();
          }
        },
      };

      if (!map.getLayer('airplane-3d-model')) {
        map.addLayer(customLayer);
      }
    });

    return () => {
      setIsMapReady(false);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [depCoord, destCoord]);

  // Update line styles dynamically when candidates change
  useEffect(() => {
    setProgress(0);
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    candidates.forEach((cand, idx) => {
      const isSel = idx === optimalRouteIndex;
      const lineId = `route-line-${idx}`;

      const geojson: any = {
        type: 'Feature',
        properties: { isOptimal: isSel },
        geometry: {
          type: 'LineString',
          coordinates: cand.coordinates,
        },
      };

      if (map.getSource && map.getSource(lineId)) {
        map.getSource(lineId).setData(geojson);
      }

      if (map.getLayer && map.getLayer(lineId)) {
        map.setPaintProperty(lineId, 'line-color', isSel ? '#3b82f6' : '#64748b');
        map.setPaintProperty(lineId, 'line-width', isSel ? 4 : 2);
        map.setPaintProperty(lineId, 'line-opacity', isSel ? 0.95 : 0.35);
        map.setPaintProperty(lineId, 'line-dasharray', isSel ? [1] : [2, 2]);
      }
    });
  }, [optimalRouteIndex, candidates]);

  // Render Airport Markers (RED location_on + Geist thin white text + live weather) and Waypoint Markers
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    const maplibregl = (window as any).maplibregl || (window as any).maptilersdk;
    if (!maplibregl || !maplibregl.Marker) return;

    // Clear existing markers
    pointMarkersRef.current.forEach((m) => m.remove());
    pointMarkersRef.current = [];

    const pointsToRender: CorridorPoint[] =
      corridorPoints.length > 0
        ? corridorPoints
        : [
            {
              id: depCode,
              point_tag: 'Point A',
              point_type: 'origin',
              name: 'Departure',
              code: depCode,
              latitude: depCoord[0],
              longitude: depCoord[1],
              coordinates: [depCoord[1], depCoord[0]],
            },
            {
              id: destCode,
              point_tag: 'Point B',
              point_type: 'destination',
              name: 'Destination',
              code: destCode,
              latitude: destCoord[0],
              longitude: destCoord[1],
              coordinates: [destCoord[1], destCoord[0]],
            },
          ];

    pointsToRender.forEach((pt) => {
      const isAirport = pt.point_type === 'origin' || pt.point_type === 'destination';

      if (isAirport) {
        // Destination & Departure Airports: Waypoint marker icon (location_on) COLORED RED
        const containerEl = document.createElement('div');
        containerEl.className = 'simple-airport-marker';

        // Airport code in simple Geist font text white color thin font weight
        const codeEl = document.createElement('div');
        codeEl.className = 'simple-airport-code';
        codeEl.innerText = pt.code || pt.id;
        containerEl.appendChild(codeEl);

        // Waypoint marker icon (location_on) colored RED
        const redPinWrap = document.createElement('div');
        redPinWrap.style.display = 'flex';
        redPinWrap.style.alignItems = 'center';
        redPinWrap.style.justifyContent = 'center';
        redPinWrap.innerHTML = `
          <svg viewBox="0 0 24 24" class="airport-red-location-icon">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `;
        containerEl.appendChild(redPinWrap);

        const marker = new maplibregl.Marker({
          element: containerEl,
          anchor: 'bottom',
        })
          .setLngLat([pt.longitude, pt.latitude])
          .addTo(mapInstance.current);

        pointMarkersRef.current.push(marker);
      }
    });

    return () => {
      pointMarkersRef.current.forEach((m) => m.remove());
      pointMarkersRef.current = [];
    };
  }, [corridorPoints, depCoord, destCoord, depCode, destCode, clientWeatherMap, isMapReady]);

  // Synchronize Live Airspace Traffic Markers (Static SVG plane icons on map)
  useEffect(() => {
    liveFlightsRef.current = clientFlights;
    if (!mapInstance.current || !isMapReady) return;
    const maplibregl = (window as any).maplibregl || (window as any).maptilersdk;
    if (!maplibregl || !maplibregl.Marker) return;

    const currentMap = flightMarkersMapRef.current;
    const activeHexes = new Set<string>();

    clientFlights.forEach((flight) => {
      activeHexes.add(flight.icao24);
      const entry = currentMap.get(flight.icao24);

      if (!entry) {
        const markerContainer = document.createElement('div');
        markerContainer.className = 'traffic-aircraft-marker';
        markerContainer.style.zIndex = '1';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'traffic-plane-rotator';
        iconWrap.style.transform = `rotate(${flight.heading || 0}deg)`;
        iconWrap.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#F9DB78" style="display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.85));">
            <path d="M283.33-80v-88.67L406-254v-162.67L80-285.33v-108L406-622v-184q0-30.33 21.83-52.17Q449.67-880 480-880q30.33 0 52.17 21.83Q554-836.33 554-806v184l326 228.67v108L554-416.67V-254l122 85.33V-80l-196-59.33L283.33-80Z"/>
          </svg>
        `;
        markerContainer.appendChild(iconWrap);

        const marker = new maplibregl.Marker({
          element: markerContainer,
          anchor: 'center',
        })
          .setLngLat([flight.longitude, flight.latitude])
          .addTo(mapInstance.current);

        currentMap.set(flight.icao24, { marker, iconWrap });
      } else {
        entry.iconWrap.style.transform = `rotate(${flight.heading || 0}deg)`;
        entry.marker.setLngLat([flight.longitude, flight.latitude]);
      }
    });

    // Remove obsolete flights
    for (const [hex, entry] of currentMap.entries()) {
      if (!activeHexes.has(hex)) {
        entry.marker.remove();
        currentMap.delete(hex);
      }
    }
  }, [clientFlights, isMapReady]);

  // Atmospheric Weather Clouds Layer (Distributed across departure, destination, and visible sky)
  useEffect(() => {
    if (!mapInstance.current || !isMapReady) return;
    const maplibregl = (window as any).maplibregl || (window as any).maptilersdk;
    if (!maplibregl || !maplibregl.Marker) return;

    // Clear previous cloud markers
    cloudMarkersRef.current.forEach((m) => m.remove());
    cloudMarkersRef.current = [];

    const cloudFiles = [
      '/clouds/White_Small_Cloud_PNG_Clipart-879.png',
      '/clouds/White_Clouds_PNG_Clipart-882.png',
      '/clouds/Clouds_PNG_Transparent_Clip_Art_Image.png',
      '/clouds/cloud_PNG112271.png',
    ];

    const depLat = depCoord[0];
    const depLon = depCoord[1];
    const destLat = destCoord[0];
    const destLon = destCoord[1];
    const midLat = (depLat + destLat) / 2;
    const midLon = (depLon + destLon) / 2;

    // Natural geographic positions surrounding departure, destination, and visible region
    const cloudPositions: { lat: number; lon: number; width: number; opacity: number }[] = [
      // 1. Surrounding Departure (e.g., BOM sector & coastal sea)
      { lat: depLat + 1.2, lon: depLon + 1.4, width: 95, opacity: 0.44 },
      { lat: depLat - 0.9, lon: depLon - 2.1, width: 110, opacity: 0.48 },
      { lat: depLat + 2.1, lon: depLon - 1.5, width: 80, opacity: 0.40 },

      // 2. Surrounding Destination (e.g., DXB, Gulf & Oman sector)
      { lat: destLat + 1.3, lon: destLon - 1.8, width: 105, opacity: 0.46 },
      { lat: destLat - 1.4, lon: destLon + 1.6, width: 85, opacity: 0.42 },
      { lat: destLat + 1.8, lon: destLon + 2.2, width: 115, opacity: 0.50 },

      // 3. Wide regional visible airspace (Arabian basin on both sides of corridor)
      { lat: midLat + 2.4, lon: midLon - 3.8, width: 110, opacity: 0.45 },
      { lat: midLat - 2.2, lon: midLon + 3.4, width: 90, opacity: 0.42 },
      { lat: midLat - 1.5, lon: midLon - 2.2, width: 120, opacity: 0.48 },
      { lat: midLat + 3.1, lon: midLon + 1.8, width: 85, opacity: 0.38 },
    ];

    cloudPositions.forEach((pos, idx) => {
      const cloudEl = document.createElement('div');
      cloudEl.className = 'map-cloud-marker';

      const imgSrc = cloudFiles[idx % cloudFiles.length];

      cloudEl.innerHTML = `
        <img src="${imgSrc}" class="map-cloud-img" style="width: ${pos.width}px; opacity: ${pos.opacity};" alt="Atmospheric Cloud" />
      `;

      const marker = new maplibregl.Marker({
        element: cloudEl,
        anchor: 'center',
      })
        .setLngLat([pos.lon, pos.lat])
        .addTo(mapInstance.current);

      cloudMarkersRef.current.push(marker);
    });

    return () => {
      cloudMarkersRef.current.forEach((m) => m.remove());
      cloudMarkersRef.current = [];
    };
  }, [depCoord, destCoord, isMapReady]);

  // Three.js Aircraft Animation Loop
  useEffect(() => {
    let animId: number;
    let t = progress;
    const maplibregl = (window as any).maplibregl || (window as any).maptilersdk;

    const animate = () => {
      if (isPlaying && pathPoints.length >= 2) {
        t += 0.0015;
        if (t > 1) {
          t = 0;
          // Trigger live air traffic update when flight finishes & restarts from origin
          if (loadClientLiveDataRef.current) {
            loadClientLiveDataRef.current(true);
          }
        }
        setProgress(t);

        const totalSegs = pathPoints.length - 1;
        const exactIndex = t * totalSegs;
        const idx = Math.min(Math.floor(exactIndex), totalSegs - 1);
        const frac = exactIndex - idx;

        const p1 = pathPoints[idx];
        const p2 = pathPoints[idx + 1] || p1;

        const lng = p1[0] + (p2[0] - p1[0]) * frac;
        const lat = p1[1] + (p2[1] - p1[1]) * frac;

        const dLng = p2[0] - p1[0];
        const dLat = p2[1] - p1[1];
        const bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;

        // Auto Globe Tracking plane orientation
        if (mapInstance.current && followPlane) {
          mapInstance.current.setCenter([lng, lat]);
          mapInstance.current.setBearing(bearing);
        }

        if (mapInstance.current && planeMeshRef.current && maplibregl?.MercatorCoordinate) {
          const modelAsMercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 18000);

          // Scaled up by 3500x so 3D airplane is clearly visible over the globe
          const planeScale = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits() * 3500;

          const transform = {
            translateX: modelAsMercatorCoordinate.x,
            translateY: modelAsMercatorCoordinate.y,
            translateZ: modelAsMercatorCoordinate.z,
            rotateX: Math.PI / 2,
            rotateY: (bearing * Math.PI) / 180,
            rotateZ: 0,
            scale: planeScale,
          };

          const rotationX = new (THREE as any).Matrix4().makeRotationX(transform.rotateX);
          const rotationY = new (THREE as any).Matrix4().makeRotationY(transform.rotateY);
          const rotationZ = new (THREE as any).Matrix4().makeRotationZ(transform.rotateZ);

          const m = new (THREE as any).Matrix4();
          m.makeTranslation(transform.translateX, transform.translateY, transform.translateZ);
          m.multiply(rotationX);
          m.multiply(rotationY);
          m.multiply(rotationZ);
          m.scale(new (THREE as any).Vector3(transform.scale, transform.scale, transform.scale));

          planeMeshRef.current.matrixAutoUpdate = false;
          planeMeshRef.current.matrix = m;
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, followPlane, pathPoints, progress]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 isolate z-0 ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Bottom Center Flight Navigation Bar (Simple, Thin UI, No Glow) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/95 text-slate-800 shadow-2xl backdrop-blur-xl border border-white/60 z-20 text-xs font-geist">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 transition text-white flex items-center gap-1.5 font-light"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? 'Pause' : 'Fly'}</span>
        </button>

        <button
          onClick={() => {
            setProgress(0);
            if (mapInstance.current) {
              mapInstance.current.flyTo({ center: [depCoord[1], depCoord[0]], zoom: 4.8, pitch: 48, bearing: 0 });
            }
          }}
          className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition text-slate-700 flex items-center gap-1"
          title="Reset to Departure"
        >
          <RotateCcw size={14} />
        </button>

        <div className="h-4 w-px bg-slate-200" />

        <button
          onClick={() => {
            const nextFollow = !followPlane;
            setFollowPlane(nextFollow);
            if (nextFollow && mapInstance.current) {
              mapInstance.current.easeTo({
                zoom: 5.4,
                pitch: 56,
                duration: 900,
              });
            }
          }}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 text-xs font-light ${
            followPlane ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Compass size={13} />
          <span>{followPlane ? 'Globe Tracking ON' : 'Free Camera'}</span>
        </button>

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
          <Plane size={13} className="text-blue-600" />
          <span className="text-slate-800 font-semibold">{depCode}</span>
          <span className="text-slate-400 font-light">➔</span>
          <span className="text-blue-600 font-semibold">{destCode}</span>
        </div>
      </div>
    </div>
  );
};

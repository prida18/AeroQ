import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteCandidate } from '../types';

interface FlightMapProps {
  origin: { code: string; name: string; coords: [number, number] } | null;
  destination: { code: string; name: string; coords: [number, number] } | null;
  routes: RouteCandidate[];
}

export const FlightMap: React.FC<FlightMapProps> = ({ origin, destination, routes }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([22.0, 68.0], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4efc_1_40e62213b473be5343c10806', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    if (!origin || !destination) return;

    const bounds: [number, number][] = [];

    // Departure Marker
    const origMarker = L.circleMarker(origin.coords, {
      color: '#a855f7',
      radius: 8,
      fillOpacity: 0.9,
    }).addTo(layerGroup);
    origMarker.bindPopup(`<b>Departure:</b> ${origin.name} (${origin.code})`).openPopup();
    bounds.push(origin.coords);

    // Destination Marker
    const destMarker = L.circleMarker(destination.coords, {
      color: '#38bdf8',
      radius: 8,
      fillOpacity: 0.9,
    }).addTo(layerGroup);
    destMarker.bindPopup(`<b>Destination:</b> ${destination.name} (${destination.code})`);
    bounds.push(destination.coords);

    // Render Flight Trajectory Polylines
    routes.forEach((r) => {
      const isOptimal = r.is_quantum_optimal;
      const color = isOptimal ? '#10b981' : '#38bdf8';
      const weight = isOptimal ? 5 : 2;
      const opacity = isOptimal ? 0.95 : 0.4;

      // Map GeoJSON [lng, lat] to Leaflet [lat, lng]
      const latLngs: [number, number][] = r.coordinates.map((c) => [c[1], c[0]]);

      const polyline = L.polyline(latLngs, {
        color: color,
        weight: weight,
        opacity: opacity,
        dashArray: isOptimal ? undefined : '6, 6',
      }).addTo(layerGroup);

      polyline.bindTooltip(
        `<b>${r.path_title}</b><br>Score: ${r.total_score} | CO₂: ${r.co2_kg} kg | Fuel: ${r.fuel_liters} L`
      );

      latLngs.forEach((c) => bounds.push(c));
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [origin, destination, routes]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '380px', borderRadius: '16px', overflow: 'hidden' }} />;
};

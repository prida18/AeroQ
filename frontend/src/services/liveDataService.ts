import type { LiveFlight, WeatherInfo } from '../types';

// In-memory caches to prevent spamming public endpoints
const weatherCache = new Map<string, { data: WeatherInfo; timestamp: number }>();
let trafficCache: { data: LiveFlight[]; timestamp: number } | null = null;

const CACHE_TTL_MS = 20000; // 20 seconds cache

/**
 * Client-side fetcher for live weather directly via Open-Meteo REST API.
 * Free, requires no API key, and has full CORS support enabled for browsers.
 */
export async function fetchLiveWeather(lat: number, lon: number): Promise<WeatherInfo> {
  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const now = Date.now();

  const cached = weatherCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current_weather=true`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const cw = data.current_weather || {};
      const temp = Math.round(cw.temperature ?? 26);
      const wind = Math.round(cw.windspeed ?? 12);
      const windDir = Math.round(cw.winddirection ?? 0);

      let cloudPct = 20;
      const wc = cw.weathercode ?? 0;
      if (wc === 1) cloudPct = 35;
      else if (wc === 2) cloudPct = 65;
      else if (wc === 3) cloudPct = 90;
      else if (wc >= 45 && wc <= 48) cloudPct = 80;
      else if (wc >= 51) cloudPct = 95;

      const weatherObj: WeatherInfo = {
        source: 'Open-Meteo Live API (Client-side)',
        is_live: true,
        temperature_c: temp,
        wind_speed_kmh: wind,
        wind_direction_deg: windDir,
        weather_code: wc,
        condition: 'Live Conditions',
        icon: '☀️',
        penalty: Math.min(10, Math.max(1, +(wind / 6).toFixed(1))),
        cloud_cover_pct: cloudPct,
      };

      weatherCache.set(cacheKey, { data: weatherObj, timestamp: now });
      return weatherObj;
    }
  } catch {
    // silent fallback below
  }

  // Simulated fallback if network is offline
  const fallback: WeatherInfo = {
    source: 'Atmospheric Model',
    is_live: false,
    temperature_c: Math.round(25 + (lat % 6)),
    wind_speed_kmh: Math.round(10 + (lon % 8)),
    wind_direction_deg: Math.round((lat * 20 + lon * 10) % 360),
    weather_code: 0,
    condition: 'Clear Sky',
    icon: '☀️',
    penalty: 2.0,
    cloud_cover_pct: 25,
  };
  return fallback;
}

/**
 * Client-side fetcher for actual live airspace traffic directly via real radar feeds.
 * Proxied via Vite /fr24 or backend /api/live-airtraffic with zero CORS issues.
 */
export async function fetchLiveAirTraffic(
  depLat: number,
  depLon: number,
  destLat: number,
  destLon: number,
  forceRefetch: boolean = false
): Promise<LiveFlight[]> {
  const now = Date.now();
  if (!forceRefetch && trafficCache && now - trafficCache.timestamp < 12000) {
    return trafficCache.data;
  }

  const minLat = Math.min(depLat, destLat) - 6.0;
  const maxLat = Math.max(depLat, destLat) + 6.0;
  const minLon = Math.min(depLon, destLon) - 8.0;
  const maxLon = Math.max(depLon, destLon) + 8.0;

  // Helper to pick well-distributed flights across departure, destination, and regional airspace
  const pickDistributedFlights = (allFlights: LiveFlight[]): LiveFlight[] => {
    if (allFlights.length <= 16) return allFlights;
    const valid = allFlights.filter((f) => !isNaN(f.latitude) && !isNaN(f.longitude));
    const step = Math.max(1, Math.floor(valid.length / 16));
    const sampled: LiveFlight[] = [];
    for (let i = 0; i < valid.length && sampled.length < 16; i += step) {
      sampled.push(valid[i]);
    }
    return sampled;
  };

  // 1. Try local proxy /fr24 to live FlightRadar24 radar feed
  try {
    const fr24Url = `/fr24/zones/fcgi/feed.js?bounds=${maxLat.toFixed(2)},${minLat.toFixed(2)},${minLon.toFixed(2)},${maxLon.toFixed(2)}`;
    const res = await fetch(fr24Url, { headers: { Accept: 'application/json' } });
    const isJson = res.headers.get('content-type')?.includes('json');
    if (res.ok && isJson) {
      const data = await res.json();

      const flights: LiveFlight[] = [];

      for (const [key, v] of Object.entries(data)) {
        if (Array.isArray(v) && v.length >= 14) {
          const hexId = String(v[0] || key);
          const lat = Number(v[1]);
          const lon = Number(v[2]);
          const heading = Number(v[3] || 0);
          const altFt = Number(v[4] || 32000);
          const speedKts = Number(v[5] || 450);
          const callsign = String(v[16] || v[13] || hexId).trim();

          if (!isNaN(lat) && !isNaN(lon)) {
            flights.push({
              icao24: hexId,
              callsign,
              country: 'Commercial Traffic',
              latitude: lat,
              longitude: lon,
              altitude_m: Math.round(altFt * 0.3048),
              altitude_ft: altFt,
              velocity_kmh: Math.round(speedKts * 1.852),
              heading: Math.round(heading),
              is_live: true,
              source: 'FlightRadar24 Live Airspace',
            });
          }
        }
      }

      if (flights.length > 0) {
        const distributed = pickDistributedFlights(flights);
        trafficCache = { data: distributed, timestamp: now };
        return distributed;
      }
    }
  } catch {
    // proceed to secondary backend proxy
  }

  // 2. Try backend live-airtraffic proxy
  try {
    const backendUrl = `/api/live-airtraffic?min_lat=${minLat.toFixed(2)}&max_lat=${maxLat.toFixed(2)}&min_lon=${minLon.toFixed(2)}&max_lon=${maxLon.toFixed(2)}&limit=20`;
    const res = await fetch(backendUrl);
    if (res.ok) {
      const flights: LiveFlight[] = await res.json();
      if (Array.isArray(flights) && flights.length > 0) {
        const distributed = pickDistributedFlights(flights);
        trafficCache = { data: distributed, timestamp: now };
        return distributed;
      }
    }
  } catch {
    // proceed to fallback
  }

  // Fallback: 6 well-distributed aircraft (around departure, destination, and visible basin)
  const simulatedFlights: LiveFlight[] = [
    // 2 around Departure
    {
      icao24: 'sim-dep-1',
      callsign: 'AIC-301',
      country: 'Departure Sector',
      latitude: depLat + 0.8,
      longitude: depLon + 0.9,
      altitude_m: 5400,
      altitude_ft: 18000,
      velocity_kmh: 620,
      heading: 285,
      is_live: false,
      source: 'Terminal Airspace',
    },
    {
      icao24: 'sim-dep-2',
      callsign: 'IGO-412',
      country: 'Departure Sector',
      latitude: depLat - 0.7,
      longitude: depLon + 1.2,
      altitude_m: 7200,
      altitude_ft: 24000,
      velocity_kmh: 710,
      heading: 310,
      is_live: false,
      source: 'Terminal Airspace',
    },
    // 2 in regional corridor
    {
      icao24: 'sim-cor-1',
      callsign: 'QTR-108',
      country: 'Regional Airspace',
      latitude: (depLat + destLat) / 2 + 1.2,
      longitude: (depLon + destLon) / 2 - 1.4,
      altitude_m: 11200,
      altitude_ft: 37000,
      velocity_kmh: 880,
      heading: 295,
      is_live: false,
      source: 'Airspace Sector Traffic',
    },
    {
      icao24: 'sim-cor-2',
      callsign: 'BAW-14',
      country: 'Regional Airspace',
      latitude: (depLat + destLat) / 2 - 1.1,
      longitude: (depLon + destLon) / 2 + 1.5,
      altitude_m: 10900,
      altitude_ft: 36000,
      velocity_kmh: 850,
      heading: 115,
      is_live: false,
      source: 'Airspace Sector Traffic',
    },
    // 2 around Destination
    {
      icao24: 'sim-dest-1',
      callsign: 'UAE-42',
      country: 'Destination Sector',
      latitude: destLat + 0.9,
      longitude: destLon - 0.8,
      altitude_m: 4800,
      altitude_ft: 16000,
      velocity_kmh: 580,
      heading: 120,
      is_live: false,
      source: 'Terminal Airspace',
    },
    {
      icao24: 'sim-dest-2',
      callsign: 'ETD-204',
      country: 'Destination Sector',
      latitude: destLat - 0.8,
      longitude: destLon - 1.1,
      altitude_m: 6400,
      altitude_ft: 21000,
      velocity_kmh: 640,
      heading: 135,
      is_live: false,
      source: 'Terminal Airspace',
    },
  ];

  trafficCache = { data: simulatedFlights, timestamp: now };
  return simulatedFlights;
}

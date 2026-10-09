export interface Airport {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

export interface Aircraft {
  model_name: string;
  description: string;
  fuel_burn_rate_l_per_km: number;
  emission_factor_kg_per_l: number;
  cruise_speed_kmh: number;
}

export interface OptimizationWeights {
  co2: number;
  fuel: number;
  distance: number;
  weather: number;
  congestion: number;
}

export interface RouteCandidate {
  path_title: string;
  path_nodes: string[];
  coordinates: [number, number][];
  distance_km: number;
  fuel_liters: number;
  co2_kg: number;
  weather_penalty: number;
  congestion_penalty: number;
  total_score: number;
  is_quantum_optimal: boolean;
}

export interface QuantumSolution {
  method: string;
  path: string[];
  total_distance_km: number;
  total_fuel_liters: number;
  total_co2_kg: number;
  total_weather_penalty: number;
  total_congestion_penalty: number;
  total_score: number;
  execution_time_ms: number;
  qubits_used: number;
  circuit_depth: number;
  optimizer_status: string;
}

export interface WeatherInfo {
  source: string;
  is_live: boolean;
  temperature_c: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  weather_code: number;
  condition: string;
  icon: string;
  penalty: number;
  cloud_cover_pct?: number;
}

export interface CorridorPoint {
  id: string;
  point_tag: string;
  point_type: 'origin' | 'destination' | 'waypoint';
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  coordinates: [number, number];
  weather?: WeatherInfo;
  congestion_penalty?: number;
}

export interface LiveFlight {
  icao24: string;
  callsign: string;
  country: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  altitude_ft: number;
  velocity_kmh: number;
  heading: number;
  is_live: boolean;
  source: string;
}

export interface OptimizationResponse {
  origin: { code: string; name: string; coords: [number, number]; weather?: WeatherInfo };
  destination: { code: string; name: string; coords: [number, number]; weather?: WeatherInfo };
  corridor_points?: CorridorPoint[];
  live_flights?: LiveFlight[];
  aircraft: string;
  data_mode: string;
  quantum_solution: QuantumSolution;
  metrics: {
    co2_saved_percent: number;
    fuel_saved_percent: number;
    qubits_used: number;
    circuit_depth: number;
  };
  all_candidate_routes: RouteCandidate[];
}


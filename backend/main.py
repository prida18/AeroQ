from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from pathlib import Path
import networkx as nx

from engine.graph import FlightGraph
from engine.models import OptimizationWeights, ConstraintConfig
from engine.cost_function import RouteCostCalculator
from engine.quantum_optimizer import QuantumOptimizer
from engine.emissions import AIRCRAFT_DATABASE
from engine.data_providers import (
    RealAirportDatasetProvider,
    OpenMeteoWeatherProvider,
    OpenSkyTrackingProvider
)

app = FastAPI(
    title="AeroQ — Quantum Flight-Path & Emissions Optimizer",
    version="2.0.0",
    description="Qiskit Quantum Circuit & QUBO Flight-Path Trajectory Optimizer for IEEE Qiskit Fall Fest."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    for subpath in FRONTEND_DIST.iterdir():
        if subpath.is_dir():
            app.mount(f"/{subpath.name}", StaticFiles(directory=str(subpath)), name=subpath.name)


airport_provider = RealAirportDatasetProvider()
weather_provider = OpenMeteoWeatherProvider()
tracking_provider = OpenSkyTrackingProvider()

class OptimizeRequest(BaseModel):
    origin: str = "BOM"
    destination: str = "DXB"
    aircraft: str = "A320NEO"
    weights: OptimizationWeights = Field(default_factory=OptimizationWeights)
    closed_waypoints: List[str] = Field(default_factory=list)
    max_congestion: float = 10.0
    use_live_data: bool = True

@app.get("/api/health")
def health_check():
    return {"status": "online", "service": "AeroQ Quantum Engine (Qiskit QAOA)", "version": "2.0.0"}

@app.get("/api/airports")
def get_airports():
    return [ap.model_dump() for ap in airport_provider.get_all_airports()]

@app.get("/api/aircraft")
def get_aircraft():
    return [ac.model_dump() for ac in AIRCRAFT_DATABASE.values()]

@app.get("/api/live-airtraffic")
def get_live_airtraffic(
    min_lat: float = 10.0,
    max_lat: float = 40.0,
    min_lon: float = 35.0,
    max_lon: float = 85.0,
    limit: int = 60
):
    """
    Returns actual live air traffic from FlightRadar24 live radar feed.
    """
    import requests
    url = f"https://data-cloud.flightradar24.com/zones/fcgi/feed.js?bounds={round(max_lat, 2)},{round(min_lat, 2)},{round(min_lon, 2)},{round(max_lon, 2)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.flightradar24.com/"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=3.5)
        if resp.status_code == 200:
            data = resp.json()
            flights = []
            for k, v in data.items():
                if isinstance(v, list) and len(v) >= 14:
                    hex_id = str(v[0])
                    lat = float(v[1])
                    lon = float(v[2])
                    heading = float(v[3])
                    alt_ft = int(v[4])
                    speed_kts = float(v[5])
                    callsign = str(v[16] if len(v) > 16 and v[16] else (v[13] if v[13] else hex_id)).strip()
                    flights.append({
                        "icao24": hex_id,
                        "callsign": callsign,
                        "country": "Commercial Airspace",
                        "latitude": lat,
                        "longitude": lon,
                        "altitude_m": round(alt_ft * 0.3048),
                        "altitude_ft": alt_ft,
                        "velocity_kmh": round(speed_kts * 1.852),
                        "heading": heading,
                        "is_live": True,
                        "source": "FlightRadar24 Live Radar"
                    })
                    if len(flights) >= limit:
                        break
            if len(flights) > 0:
                return flights
    except Exception:
        pass
    
    # Fallback: query OpenSky Network or generate realistic sector traffic
    return tracking_provider.get_live_flights_in_corridor(min_lat, max_lat, min_lon, max_lon, limit=limit)



@app.post("/api/optimize")
def optimize_flight(req: OptimizeRequest):
    if req.origin == req.destination:
        raise HTTPException(status_code=400, detail="Departure and Destination airports cannot be identical.")

    origin_ap = airport_provider.get_airport_by_code(req.origin)
    dest_ap = airport_provider.get_airport_by_code(req.destination)

    if not origin_ap or not dest_ap:
        raise HTTPException(status_code=400, detail=f"Invalid airport selection: {req.origin} -> {req.destination}")

    # 1. Dynamically construct flight network corridor for selected airport pair
    active_graph = FlightGraph.create_dynamic_corridor(origin_ap, dest_ap)

    # 2. Update graph edges with live weather & wind data and air traffic congestion
    is_live_active = False
    if req.use_live_data:
        try:
            for u, v, attrs in active_graph.graph.edges(data=True):
                u_node = active_graph.get_node(u)
                v_node = active_graph.get_node(v)
                if u_node and v_node:
                    mid_lat = (u_node.latitude + v_node.latitude) / 2.0
                    mid_lon = (u_node.longitude + v_node.longitude) / 2.0
                    
                    wx_pen, wx_info = weather_provider.get_weather_penalty(mid_lat, mid_lon)
                    cong_pen, cong_info = tracking_provider.get_congestion_penalty(mid_lat, mid_lon)

                    attrs["weather_penalty"] = wx_pen
                    attrs["congestion_penalty"] = cong_pen
                    if wx_info.get("is_live") or cong_info.get("is_live"):
                        is_live_active = True
        except Exception:
            is_live_active = False

    constraints = ConstraintConfig(
        closed_waypoints=set(req.closed_waypoints),
        max_allowed_congestion=req.max_congestion
    )

    try:
        # 3. Execute Quantum Optimizer (Qiskit QAOA + QUBO)
        q_res = QuantumOptimizer.optimize(
            flight_graph=active_graph,
            origin=req.origin,
            destination=req.destination,
            weights=req.weights,
            constraints=constraints,
            aircraft=req.aircraft
        )

        # 4. Find ALL candidate paths in the flight network
        try:
            candidate_paths = list(nx.all_simple_paths(active_graph.graph, source=req.origin, target=req.destination))
        except Exception:
            candidate_paths = [q_res.path]

        all_routes_evaluated = []
        quantum_best_path = q_res.path

        for path in candidate_paths:
            try:
                from engine.constraints import ConstraintEngine
                val = ConstraintEngine.validate_path(active_graph, path, constraints)
                if not val.is_valid:
                    continue

                breakdown = RouteCostCalculator.calculate_route_cost(
                    flight_graph=active_graph,
                    path=path,
                    weights=req.weights,
                    aircraft=req.aircraft
                )
                
                # Extract lon/lat map coordinates for polyline rendering (GeoJSON [lng, lat] standard)
                path_coords = []
                for node_id in path:
                    node_obj = active_graph.get_node(node_id)
                    if node_obj:
                        path_coords.append([node_obj.longitude, node_obj.latitude])

                is_optimal = (path == quantum_best_path)
                display_name = " -> ".join(path).replace("_WAY_A", " (Waypoint α)").replace("_WAY_B", " (Waypoint β)").replace("_WAY_C", " (Waypoint γ)").replace("_WAY_D", " (Waypoint δ)")

                all_routes_evaluated.append({
                    "path_title": display_name,
                    "path_nodes": path,
                    "coordinates": path_coords,
                    "distance_km": breakdown.total_distance_km,
                    "fuel_liters": breakdown.total_fuel_liters,
                    "co2_kg": breakdown.total_co2_kg,
                    "weather_penalty": breakdown.total_weather_penalty,
                    "congestion_penalty": breakdown.total_congestion_penalty,
                    "total_score": breakdown.total_score,
                    "is_quantum_optimal": is_optimal
                })
            except Exception:
                continue

        all_routes_evaluated.sort(key=lambda x: x["total_score"])

        worst_co2 = max(r["co2_kg"] for r in all_routes_evaluated) if all_routes_evaluated else q_res.total_co2_kg
        worst_fuel = max(r["fuel_liters"] for r in all_routes_evaluated) if all_routes_evaluated else q_res.total_fuel_liters
        
        saved_co2_pct = round(((worst_co2 - q_res.total_co2_kg) / worst_co2) * 100.0, 1) if worst_co2 > 0 else 0.0
        saved_fuel_pct = round(((worst_fuel - q_res.total_fuel_liters) / worst_fuel) * 100.0, 1) if worst_fuel > 0 else 0.0

        # Build comprehensive Point A, Point B, and intermediate waypoint metadata
        origin_wx = weather_provider.get_live_weather(origin_ap.latitude, origin_ap.longitude)
        dest_wx = weather_provider.get_live_weather(dest_ap.latitude, dest_ap.longitude)

        origin_point = {
            "id": origin_ap.id,
            "point_tag": "Point A",
            "point_type": "origin",
            "name": origin_ap.name,
            "code": origin_ap.id,
            "latitude": origin_ap.latitude,
            "longitude": origin_ap.longitude,
            "coordinates": [origin_ap.longitude, origin_ap.latitude],
            "weather": origin_wx
        }

        dest_point = {
            "id": dest_ap.id,
            "point_tag": "Point B",
            "point_type": "destination",
            "name": dest_ap.name,
            "code": dest_ap.id,
            "latitude": dest_ap.latitude,
            "longitude": dest_ap.longitude,
            "coordinates": [dest_ap.longitude, dest_ap.latitude],
            "weather": dest_wx
        }

        waypoint_points = []
        for node_id, node_obj in active_graph.nodes_data.items():
            if node_id in (origin_ap.id, dest_ap.id):
                continue
            w_wx = weather_provider.get_live_weather(node_obj.latitude, node_obj.longitude)
            w_cong, _ = tracking_provider.get_congestion_penalty(node_obj.latitude, node_obj.longitude)
            tag = "Waypoint"
            if "WAY_A" in node_id: tag = "Waypoint α"
            elif "WAY_B" in node_id: tag = "Waypoint β"
            elif "WAY_C" in node_id: tag = "Waypoint γ"
            elif "WAY_D" in node_id: tag = "Waypoint δ"

            waypoint_points.append({
                "id": node_id,
                "point_tag": tag,
                "point_type": "waypoint",
                "name": node_obj.name,
                "code": node_id,
                "latitude": node_obj.latitude,
                "longitude": node_obj.longitude,
                "coordinates": [node_obj.longitude, node_obj.latitude],
                "weather": w_wx,
                "congestion_penalty": w_cong
            })

        # Fetch live airspace flights operating within the corridor bounding box
        min_lat = min(origin_ap.latitude, dest_ap.latitude)
        max_lat = max(origin_ap.latitude, dest_ap.latitude)
        min_lon = min(origin_ap.longitude, dest_ap.longitude)
        max_lon = max(origin_ap.longitude, dest_ap.longitude)
        live_flights = tracking_provider.get_live_flights_in_corridor(min_lat, max_lat, min_lon, max_lon, limit=25)

        return {
            "origin": {"code": origin_ap.id, "name": origin_ap.name, "coords": [origin_ap.latitude, origin_ap.longitude], "weather": origin_wx},
            "destination": {"code": dest_ap.id, "name": dest_ap.name, "coords": [dest_ap.latitude, dest_ap.longitude], "weather": dest_wx},
            "corridor_points": [origin_point, *waypoint_points, dest_point],
            "live_flights": live_flights,
            "aircraft": req.aircraft,
            "data_mode": "Live Data (Open-Meteo & OpenSky Active)" if is_live_active or any(f.get("is_live") for f in live_flights) else "Simulation Fallback",
            "quantum_solution": q_res.model_dump(),
            "metrics": {
                "co2_saved_percent": saved_co2_pct,
                "fuel_saved_percent": saved_fuel_pct,
                "qubits_used": q_res.qubits_used,
                "circuit_depth": q_res.circuit_depth
            },
            "all_candidate_routes": all_routes_evaluated
        }

    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@app.get("/api/live-corridor")
def get_live_corridor_data(origin: str = "BOM", destination: str = "DXB"):
    """
    Returns real-time weather and airspace flight telemetry along the flight corridor
    without triggering full QAOA circuit recomputation.
    """
    origin_ap = airport_provider.get_airport_by_code(origin)
    dest_ap = airport_provider.get_airport_by_code(destination)
    if not origin_ap or not dest_ap:
        raise HTTPException(status_code=400, detail="Invalid airport selection.")

    active_graph = FlightGraph.create_dynamic_corridor(origin_ap, dest_ap)
    origin_wx = weather_provider.get_live_weather(origin_ap.latitude, origin_ap.longitude)
    dest_wx = weather_provider.get_live_weather(dest_ap.latitude, dest_ap.longitude)

    origin_point = {
        "id": origin_ap.id,
        "point_tag": "Point A",
        "point_type": "origin",
        "name": origin_ap.name,
        "code": origin_ap.id,
        "latitude": origin_ap.latitude,
        "longitude": origin_ap.longitude,
        "coordinates": [origin_ap.longitude, origin_ap.latitude],
        "weather": origin_wx
    }

    dest_point = {
        "id": dest_ap.id,
        "point_tag": "Point B",
        "point_type": "destination",
        "name": dest_ap.name,
        "code": dest_ap.id,
        "latitude": dest_ap.latitude,
        "longitude": dest_ap.longitude,
        "coordinates": [dest_ap.longitude, dest_ap.latitude],
        "weather": dest_wx
    }

    waypoint_points = []
    for node_id, node_obj in active_graph.nodes_data.items():
        if node_id in (origin_ap.id, dest_ap.id):
            continue
        w_wx = weather_provider.get_live_weather(node_obj.latitude, node_obj.longitude)
        w_cong, _ = tracking_provider.get_congestion_penalty(node_obj.latitude, node_obj.longitude)
        tag = "Waypoint"
        if "WAY_A" in node_id: tag = "Waypoint α"
        elif "WAY_B" in node_id: tag = "Waypoint β"
        elif "WAY_C" in node_id: tag = "Waypoint γ"
        elif "WAY_D" in node_id: tag = "Waypoint δ"

        waypoint_points.append({
            "id": node_id,
            "point_tag": tag,
            "point_type": "waypoint",
            "name": node_obj.name,
            "code": node_id,
            "latitude": node_obj.latitude,
            "longitude": node_obj.longitude,
            "coordinates": [node_obj.longitude, node_obj.latitude],
            "weather": w_wx,
            "congestion_penalty": w_cong
        })

    min_lat = min(origin_ap.latitude, dest_ap.latitude)
    max_lat = max(origin_ap.latitude, dest_ap.latitude)
    min_lon = min(origin_ap.longitude, dest_ap.longitude)
    max_lon = max(origin_ap.longitude, dest_ap.longitude)
    live_flights = tracking_provider.get_live_flights_in_corridor(min_lat, max_lat, min_lon, max_lon, limit=25)

    return {
        "origin": origin_point,
        "destination": dest_point,
        "corridor_points": [origin_point, *waypoint_points, dest_point],
        "live_flights": live_flights
    }


@app.get("/")
@app.get("/{full_path:path}")
def serve_dashboard(full_path: str = ""):
    """Serves root static files, compiled React production frontend, or fallback."""
    if full_path:
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "AeroQ Quantum API is online. Please build frontend or use Vite dev server."}


from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set

class FlightNode(BaseModel):
    id: str
    name: str
    type: str  # "airport" or "waypoint"
    latitude: float
    longitude: float

class FlightEdge(BaseModel):
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")
    distance_km: float
    fuel_liters: float = 0.0
    co2_kg: float = 0.0
    weather_penalty: float = 0.0
    congestion_penalty: float = 0.0
    restricted: bool = False

    class Config:
        populate_by_name = True

class FlightNetworkData(BaseModel):
    nodes: List[FlightNode]
    edges: List[FlightEdge]

class AircraftProfile(BaseModel):
    model_name: str
    description: str
    fuel_burn_rate_l_per_km: float
    emission_factor_kg_per_l: float = 2.52
    cruise_speed_kmh: float = 840.0
    is_simulation_model: bool = True

class ConstraintConfig(BaseModel):
    closed_waypoints: Set[str] = Field(default_factory=set)
    restricted_edges: Set[tuple[str, str]] = Field(default_factory=set)
    max_allowed_congestion: float = 10.0
    max_allowed_weather: float = 10.0

class ValidationResult(BaseModel):
    is_valid: bool
    violations: List[str] = Field(default_factory=list)

class OptimizationWeights(BaseModel):
    distance: float = 0.20
    fuel: float = 0.30
    co2: float = 0.35
    weather: float = 0.10
    congestion: float = 0.05

class RouteCostBreakdown(BaseModel):
    path: List[str]
    total_distance_km: float
    total_fuel_liters: float
    total_co2_kg: float
    total_weather_penalty: float
    total_congestion_penalty: float
    total_score: float
    weights: OptimizationWeights
    aircraft_model: str = "A320 (Simulated)"

class ClassicalOptimizationResult(BaseModel):
    method: str = "Classical Dijkstra (Constrained Multi-Objective)"
    path: List[str]
    total_distance_km: float
    total_fuel_liters: float
    total_co2_kg: float
    total_weather_penalty: float
    total_congestion_penalty: float
    total_score: float
    execution_time_ms: float
    weights: OptimizationWeights
    aircraft_model: str = "A320 (Simulated)"

class QuantumOptimizationResult(BaseModel):
    method: str = "QAOA (Local Quantum Simulator)"
    path: List[str]
    total_distance_km: float
    total_fuel_liters: float
    total_co2_kg: float
    total_weather_penalty: float
    total_congestion_penalty: float
    total_score: float
    execution_time_ms: float
    qubits_used: int
    circuit_depth: Optional[int] = 0
    optimizer_status: str = "SUCCESS"
    is_fallback: bool = False
    weights: OptimizationWeights
    aircraft_model: str = "A320 (Simulated)"

class OptimizationComparisonResult(BaseModel):
    origin: str
    destination: str
    aircraft: str
    classical: ClassicalOptimizationResult
    quantum: QuantumOptimizationResult
    co2_difference_percent: float
    fuel_difference_percent: float
    distance_difference_percent: float
    score_difference_percent: float
    summary_narrative: str

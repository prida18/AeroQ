from typing import List, Dict, Any, Optional
import networkx as nx
from .models import OptimizationWeights, RouteCostBreakdown, AircraftProfile
from .graph import FlightGraph
from .emissions import EmissionsCalculator

class RouteCostCalculator:
    """
    Modular Multi-Objective Cost Calculator for AeroQ.
    Calculates composite flight route scores from configurable objective weights and aircraft profiles.
    """

    @staticmethod
    def calculate_edge_cost(
        edge_attrs: Dict[str, Any],
        weights: OptimizationWeights,
        aircraft: Optional[str | AircraftProfile] = "A320"
    ) -> float:
        """
        Calculates the weighted objective score for a single flight edge segment.
        """
        d = edge_attrs.get("distance_km", 0.0)
        wx = edge_attrs.get("weather_penalty", 0.0)
        cg = edge_attrs.get("congestion_penalty", 0.0)

        # Calculate estimated fuel and CO2 dynamically using selected aircraft profile
        fuel, co2 = EmissionsCalculator.calculate_segment_emissions(d, wx, aircraft)

        score = (
            d * weights.distance +
            fuel * weights.fuel +
            co2 * weights.co2 +
            wx * (weights.weather * 50.0) +
            cg * (weights.congestion * 50.0)
        )
        return round(score, 4)

    @classmethod
    def calculate_route_cost(
        cls,
        flight_graph: FlightGraph,
        path: List[str],
        weights: Optional[OptimizationWeights] = None,
        aircraft: Optional[str | AircraftProfile] = "A320"
    ) -> RouteCostBreakdown:
        """
        Calculates aggregate metrics and multi-objective score for a full route path.
        """
        if weights is None:
            weights = OptimizationWeights()

        profile = EmissionsCalculator.get_aircraft_profile(aircraft if isinstance(aircraft, str) else aircraft.model_name)

        total_distance = 0.0
        total_fuel = 0.0
        total_co2 = 0.0
        total_wx = 0.0
        total_cg = 0.0
        total_score = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge_data = flight_graph.get_edge_data(u, v)
            if edge_data is None:
                raise ValueError(f"No valid edge exists between '{u}' and '{v}'.")

            d = edge_data.get("distance_km", 0.0)
            wx = edge_data.get("weather_penalty", 0.0)
            cg = edge_data.get("congestion_penalty", 0.0)

            fuel, co2 = EmissionsCalculator.calculate_segment_emissions(d, wx, profile)

            total_distance += d
            total_fuel += fuel
            total_co2 += co2
            total_wx += wx
            total_cg += cg
            
            edge_score = cls.calculate_edge_cost(edge_data, weights, profile)
            total_score += edge_score

        return RouteCostBreakdown(
            path=path,
            total_distance_km=round(total_distance, 2),
            total_fuel_liters=round(total_fuel, 2),
            total_co2_kg=round(total_co2, 2),
            total_weather_penalty=round(total_wx, 2),
            total_congestion_penalty=round(total_cg, 2),
            total_score=round(total_score, 4),
            weights=weights,
            aircraft_model=f"{profile.model_name} (Simulated)"
        )

    @classmethod
    def get_weighted_graph(
        cls,
        flight_graph: FlightGraph,
        weights: Optional[OptimizationWeights] = None,
        aircraft: Optional[str | AircraftProfile] = "A320"
    ) -> nx.DiGraph:
        """
        Returns a copy of the NetworkX DiGraph with 'weight' attributes set to multi-objective score.
        """
        if weights is None:
            weights = OptimizationWeights()

        weighted_g = flight_graph.graph.copy()
        for u, v, attrs in weighted_g.edges(data=True):
            weighted_g[u][v]["weight"] = cls.calculate_edge_cost(attrs, weights, aircraft)
        return weighted_g

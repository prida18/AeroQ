import time
from typing import Optional, List
import networkx as nx

from .models import OptimizationWeights, ClassicalOptimizationResult, ConstraintConfig
from .graph import FlightGraph
from .cost_function import RouteCostCalculator
from .constraints import ConstraintEngine
from .emissions import EmissionsCalculator

class ClassicalOptimizer:
    """
    Classical Flight-Path Optimizer using Dijkstra's algorithm.
    Enforces hard constraints (airspace restrictions, closed waypoints, congestion limits)
    and minimizes the composite multi-objective cost function.
    """

    @classmethod
    def optimize(
        cls,
        flight_graph: FlightGraph,
        origin: str,
        destination: str,
        weights: Optional[OptimizationWeights] = None,
        constraints: Optional[ConstraintConfig] = None,
        aircraft: str = "A320"
    ) -> ClassicalOptimizationResult:
        """
        Finds the optimal feasible flight trajectory from origin to destination.

        Args:
            flight_graph: The FlightGraph network.
            origin: Airport code (e.g. 'DEL').
            destination: Airport code (e.g. 'BOM').
            weights: Configurable OptimizationWeights object.
            constraints: Hard constraint rules (closed waypoints, restricted edges, etc.)
            aircraft: Aircraft model key (e.g. 'A320', 'B737', 'A350').

        Returns:
            ClassicalOptimizationResult containing path, total score, emissions, fuel, distance, and execution time.
        """
        if weights is None:
            weights = OptimizationWeights()
        if constraints is None:
            constraints = ConstraintConfig()

        start_time = time.perf_counter()

        # Step 1: Filter out all hard constraint violations from graph
        valid_g = ConstraintEngine.get_constrained_networkx_graph(flight_graph, constraints)

        # Step 2: Validate origin and destination availability in constrained graph
        if origin not in valid_g:
            raise ValueError(f"Origin node '{origin}' is either missing or blocked by hard constraints.")
        if destination not in valid_g:
            raise ValueError(f"Destination node '{destination}' is either missing or blocked by hard constraints.")

        # Step 3: Compute edge weights for multi-objective cost
        profile = EmissionsCalculator.get_aircraft_profile(aircraft)
        for u, v, attrs in valid_g.edges(data=True):
            valid_g[u][v]["weight"] = RouteCostCalculator.calculate_edge_cost(attrs, weights, profile)

        # Step 4: Run Dijkstra shortest path on valid constrained graph
        try:
            shortest_path = nx.dijkstra_path(
                valid_g,
                source=origin,
                target=destination,
                weight="weight"
            )
        except nx.NetworkXNoPath:
            raise ValueError(f"No valid feasible path found between '{origin}' and '{destination}' satisfying constraints.")

        end_time = time.perf_counter()
        execution_time_ms = round((end_time - start_time) * 1000.0, 3)

        # Step 5: Verify candidate route with ConstraintEngine
        validation = ConstraintEngine.validate_path(flight_graph, shortest_path, constraints)
        if not validation.is_valid:
            raise ValueError(f"Constraint Engine rejection: {'; '.join(validation.violations)}")

        # Step 6: Calculate complete route breakdown metrics
        breakdown = RouteCostCalculator.calculate_route_cost(flight_graph, shortest_path, weights, profile)

        return ClassicalOptimizationResult(
            method="Classical Dijkstra (Constrained Multi-Objective)",
            path=breakdown.path,
            total_distance_km=breakdown.total_distance_km,
            total_fuel_liters=breakdown.total_fuel_liters,
            total_co2_kg=breakdown.total_co2_kg,
            total_weather_penalty=breakdown.total_weather_penalty,
            total_congestion_penalty=breakdown.total_congestion_penalty,
            total_score=breakdown.total_score,
            execution_time_ms=execution_time_ms,
            weights=weights,
            aircraft_model=breakdown.aircraft_model
        )

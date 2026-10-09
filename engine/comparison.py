"""
AeroQ Solution Comparison Engine (engine/comparison.py)

WHAT IT DOES:
  Executes both Classical (Dijkstra) and Quantum-Assisted (QUBO + QAOA) optimizers 
  on the exact same flight network problem and computes comparative metrics.

WHY IT EXISTS:
  Demonstrates solution quality, estimated emissions difference, route equivalence,
  and computational performance side-by-side for hackathon presentation.
"""

from typing import Optional
from .models import (
    OptimizationWeights,
    ConstraintConfig,
    OptimizationComparisonResult
)
from .graph import FlightGraph
from .classical_optimizer import ClassicalOptimizer
from .quantum_optimizer import QuantumOptimizer

class RouteComparator:
    """
    Executes and compares Classical vs Quantum-Assisted trajectory optimization.
    """

    @classmethod
    def compare(
        cls,
        flight_graph: FlightGraph,
        origin: str,
        destination: str,
        weights: Optional[OptimizationWeights] = None,
        constraints: Optional[ConstraintConfig] = None,
        aircraft: str = "A320"
    ) -> OptimizationComparisonResult:
        """
        Runs Classical Dijkstra and Quantum QAOA side-by-side on the exact same problem.
        """
        if weights is None:
            weights = OptimizationWeights()
        if constraints is None:
            constraints = ConstraintConfig()

        # 1. Run Classical Optimizer
        cl_res = ClassicalOptimizer.optimize(
            flight_graph=flight_graph,
            origin=origin,
            destination=destination,
            weights=weights,
            constraints=constraints,
            aircraft=aircraft
        )

        # 2. Run Quantum-Assisted QAOA Optimizer
        q_res = QuantumOptimizer.optimize(
            flight_graph=flight_graph,
            origin=origin,
            destination=destination,
            weights=weights,
            constraints=constraints,
            aircraft=aircraft
        )

        # 3. Compute Percentage Differences
        def calc_pct(q_val: float, c_val: float) -> float:
            if c_val == 0:
                return 0.0
            return round(((q_val - c_val) / c_val) * 100.0, 2)

        co2_diff = calc_pct(q_res.total_co2_kg, cl_res.total_co2_kg)
        fuel_diff = calc_pct(q_res.total_fuel_liters, cl_res.total_fuel_liters)
        dist_diff = calc_pct(q_res.total_distance_km, cl_res.total_distance_km)
        score_diff = calc_pct(q_res.total_score, cl_res.total_score)

        # 4. Generate Narrative Summary
        same_route = cl_res.path == q_res.path
        if same_route:
            narrative = (
                f"Both Classical Dijkstra and QAOA Quantum Simulation converged to the exact same "
                f"optimal trajectory {' -> '.join(cl_res.path)}, confirming quantum-classical solution parity."
            )
        else:
            narrative = (
                f"Classical solver selected {' -> '.join(cl_res.path)}, while QAOA selected "
                f"{' -> '.join(q_res.path)}. CO2 difference: {co2_diff}%, Fuel difference: {fuel_diff}%."
            )

        return OptimizationComparisonResult(
            origin=origin,
            destination=destination,
            aircraft=aircraft,
            classical=cl_res,
            quantum=q_res,
            co2_difference_percent=co2_diff,
            fuel_difference_percent=fuel_diff,
            distance_difference_percent=dist_diff,
            score_difference_percent=score_diff,
            summary_narrative=narrative
        )

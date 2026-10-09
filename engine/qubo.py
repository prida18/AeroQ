"""
AeroQ QUBO Formulation Engine (engine/qubo.py)

WHAT IT DOES:
  Translates the flight network graph and multi-objective green routing priorities into a 
  Quadratic Unconstrained Binary Optimization (QUBO) problem.

WHY IT EXISTS:
  Quantum optimization algorithms (like QAOA and VQE) cannot directly process standard 
  shortest-path graphs. Instead, they require the problem to be formulated as a binary 
  energy minimization problem where decisions are represented as 0 or 1.

WHAT GOES IN:
  - FlightGraph (network of airports/waypoints and edges)
  - Origin airport (e.g., 'DEL')
  - Destination airport (e.g., 'BOM')
  - OptimizationWeights (multi-objective priority weights)
  - ConstraintConfig (airspace closures, restricted edges)
  - AircraftProfile / Aircraft model key

WHAT COMES OUT:
  - QUBOFormulation object containing:
      * Qiskit QuadraticProgram
      * Binary variable mappings (e.g., x_DEL_A -> edge (DEL, A))
      * Linear and quadratic cost matrix dictionaries
      * Route reconstruction helper methods
"""

from typing import Dict, List, Tuple, Optional, Any
import networkx as nx
from qiskit_optimization.problems import QuadraticProgram

from .models import OptimizationWeights, ConstraintConfig
from .graph import FlightGraph
from .cost_function import RouteCostCalculator
from .constraints import ConstraintEngine
from .emissions import EmissionsCalculator

class QUBOFormulation:
    """
    Encapsulates the QUBO binary decision variables, penalty terms, and Qiskit QuadraticProgram.
    """

    def __init__(
        self,
        flight_graph: FlightGraph,
        origin: str,
        destination: str,
        weights: Optional[OptimizationWeights] = None,
        constraints: Optional[ConstraintConfig] = None,
        aircraft: str = "A320",
        penalty_multiplier: float = 5000.0
    ):
        self.flight_graph = flight_graph
        self.origin = origin
        self.destination = destination
        self.weights = weights or OptimizationWeights()
        self.constraints = constraints or ConstraintConfig()
        self.aircraft = aircraft
        self.penalty_multiplier = penalty_multiplier

        # List of all valid directed edges in the network
        self.edges: List[Tuple[str, str]] = list(flight_graph.graph.edges())
        
        # Mappings between binary variables and graph edges
        # Example: edge ("DEL", "A") -> binary variable "x_DEL_A"
        self.var_names: List[str] = [f"x_{u}_{v}" for u, v in self.edges]
        self.edge_to_var: Dict[Tuple[str, str], str] = {edge: var for edge, var in zip(self.edges, self.var_names)}
        self.var_to_edge: Dict[str, Tuple[str, str]] = {var: edge for edge, var in zip(self.edges, self.var_names)}
        
        # Initialize Qiskit QuadraticProgram
        self.qp = QuadraticProgram(name="AeroQ_Flight_Path_QUBO")
        self._build_qubo()

    def _build_qubo(self) -> None:
        """
        Constructs the binary quadratic optimization problem:
          MINIMIZE:
             Route Cost (linear) + Flow Conservation Penalties (quadratic) + Airspace Constraint Penalties (linear)
        """
        # 1. Add binary variables x_i in {0, 1} for each flight edge
        for var_name in self.var_names:
            self.qp.binary_var(name=var_name)

        linear_terms: Dict[str, float] = {var: 0.0 for var in self.var_names}
        quadratic_terms: Dict[Tuple[str, str], float] = {}

        # 2. Add Primary Multi-Objective Edge Costs (Linear)
        # Using the EXACT SAME cost calculation as the classical optimizer
        profile = EmissionsCalculator.get_aircraft_profile(self.aircraft)
        for u, v in self.edges:
            var_name = self.edge_to_var[(u, v)]
            edge_data = self.flight_graph.get_edge_data(u, v) or {}
            c_e = RouteCostCalculator.calculate_edge_cost(edge_data, self.weights, profile)
            linear_terms[var_name] += c_e

        # 3. Add Hard Airspace & Restricted Edge Penalties
        for u, v in self.edges:
            var_name = self.edge_to_var[(u, v)]
            edge_data = self.flight_graph.get_edge_data(u, v) or {}
            
            # Check hard constraints using ConstraintEngine
            validation = ConstraintEngine.validate_edge(u, v, edge_data, self.constraints)
            if not validation.is_valid:
                # Assign massive penalty to prevent quantum optimizer from selecting this edge
                linear_terms[var_name] += self.penalty_multiplier * 50.0

        # 4. Add Flow Conservation Penalties (Path Connectivity Constraints)
        # Flow Conservation Rule:
        # - Origin node: Outflow - Inflow = 1  =>  (sum(x_out) - sum(x_in) - 1)^2 = 0
        # - Destination node: Inflow - Outflow = 1  =>  (sum(x_in) - sum(x_out) - 1)^2 = 0
        # - Intermediate node w: Inflow = Outflow  =>  (sum(x_in) - sum(x_out))^2 = 0

        P = self.penalty_multiplier
        all_nodes = self.flight_graph.get_all_nodes()

        for node in all_nodes:
            out_vars = [self.edge_to_var[(node, v)] for v in self.flight_graph.graph.successors(node)]
            in_vars = [self.edge_to_var[(u, node)] for u in self.flight_graph.graph.predecessors(node)]

            if node == self.origin:
                # Constraint: (sum(out_vars) - sum(in_vars) - 1)^2 = 0
                # Expansion: (sum(out) - sum(in))^2 - 2*(sum(out) - sum(in)) + 1
                for v_out in out_vars:
                    linear_terms[v_out] -= 2.0 * P
                for v_in in in_vars:
                    linear_terms[v_in] += 2.0 * P

                self._add_squared_sum_quadratic(out_vars, in_vars, P, quadratic_terms, linear_terms)

            elif node == self.destination:
                # Constraint: (sum(in_vars) - sum(out_vars) - 1)^2 = 0
                for v_in in in_vars:
                    linear_terms[v_in] -= 2.0 * P
                for v_out in out_vars:
                    linear_terms[v_out] += 2.0 * P

                self._add_squared_sum_quadratic(in_vars, out_vars, P, quadratic_terms, linear_terms)

            else:
                # Intermediate Waypoint Constraint: (sum(in_vars) - sum(out_vars))^2 = 0
                self._add_squared_sum_quadratic(in_vars, out_vars, P, quadratic_terms, linear_terms)

        # Register linear and quadratic terms into Qiskit QuadraticProgram
        self.qp.minimize(linear=linear_terms, quadratic=quadratic_terms)

    def _add_squared_sum_quadratic(
        self,
        pos_vars: List[str],
        neg_vars: List[str],
        penalty: float,
        quadratic_terms: Dict[Tuple[str, str], float],
        linear_terms: Dict[str, float]
    ) -> None:
        """
        Helper to expand (sum(pos_vars) - sum(neg_vars))^2 into binary linear and quadratic terms.
        For binary variables, x_i^2 = x_i.
        """
        # Expanding (A - B)^2 = A^2 + B^2 - 2AB
        
        # 1. pos_vars expansion: sum(x_i)^2 = sum(x_i) + 2 * sum_{i < j} x_i x_j
        for i, v1 in enumerate(pos_vars):
            linear_terms[v1] += penalty  # x_i^2 = x_i
            for j in range(i + 1, len(pos_vars)):
                v2 = pos_vars[j]
                key = (min(v1, v2), max(v1, v2))
                quadratic_terms[key] = quadratic_terms.get(key, 0.0) + 2.0 * penalty

        # 2. neg_vars expansion: sum(y_k)^2 = sum(y_k) + 2 * sum_{k < l} y_k y_l
        for k, v1 in enumerate(neg_vars):
            linear_terms[v1] += penalty  # y_k^2 = y_k
            for l in range(k + 1, len(neg_vars)):
                v2 = neg_vars[l]
                key = (min(v1, v2), max(v1, v2))
                quadratic_terms[key] = quadratic_terms.get(key, 0.0) + 2.0 * penalty

        # 3. Cross terms: -2 * sum_{i, k} x_i y_k
        for v1 in pos_vars:
            for v2 in neg_vars:
                key = (min(v1, v2), max(v1, v2))
                quadratic_terms[key] = quadratic_terms.get(key, 0.0) - 2.0 * penalty

    def reconstruct_route(self, binary_solution: Dict[str, int] | List[int]) -> Tuple[List[str], bool]:
        """
        Reconstructs an ordered list of airport/waypoint node IDs (e.g. ['DEL', 'A', 'B', 'BOM'])
        from the binary decision vector returned by the solver.

        Returns:
           Tuple (route_nodes, is_connected_and_valid)
        """
        if isinstance(binary_solution, list):
            bit_dict = {self.var_names[i]: val for i, val in enumerate(binary_solution)}
        else:
            bit_dict = binary_solution

        # Extract selected active edges (where x_var == 1)
        selected_edges = [self.var_to_edge[var] for var, val in bit_dict.items() if round(val) == 1]
        
        if not selected_edges:
            return [self.origin], False

        # Build a temporary graph of selected edges to trace path from origin to destination
        sol_graph = nx.DiGraph()
        for u, v in selected_edges:
            sol_graph.add_edge(u, v)

        if self.origin not in sol_graph or self.destination not in sol_graph:
            return [self.origin], False

        try:
            route = nx.shortest_path(sol_graph, source=self.origin, target=self.destination)
            return route, True
        except nx.NetworkXNoPath:
            return [self.origin], False

    def get_summary(self) -> str:
        """Returns a human-readable explanation of the QUBO setup."""
        num_vars = len(self.var_names)
        lines = [
            f"=== AeroQ QUBO Formulation Summary ===",
            f"Binary Decision Variables ({num_vars}):",
            f"  " + ", ".join(self.var_names),
            f"Origin: {self.origin} --> Destination: {self.destination}",
            f"Penalty Multiplier (Lambda): {self.penalty_multiplier}",
            f"Qiskit QuadraticProgram Name: {self.qp.name}"
        ]
        return "\n".join(lines)

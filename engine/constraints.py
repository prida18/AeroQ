from typing import List, Set, Tuple
import networkx as nx
from .models import ConstraintConfig, ValidationResult
from .graph import FlightGraph

class ConstraintEngine:
    """
    Independent Hard-Constraint Engine for AeroQ.
    Validates airspace safety, closed waypoints, restricted zones, and congestion bounds.
    Invalid candidate paths or graph components violating hard constraints are completely filtered out.
    """

    @classmethod
    def validate_edge(
        cls,
        u: str,
        v: str,
        edge_data: dict,
        config: ConstraintConfig
    ) -> ValidationResult:
        """Validates a single edge against hard constraints."""
        violations = []

        # Check closed waypoints
        if u in config.closed_waypoints:
            violations.append(f"Origin node '{u}' is a closed waypoint.")
        if v in config.closed_waypoints:
            violations.append(f"Destination node '{v}' is a closed waypoint.")

        # Check restricted edge list
        if (u, v) in config.restricted_edges or (v, u) in config.restricted_edges:
            violations.append(f"Segment '{u}' -> '{v}' is in a restricted flight zone.")

        # Check restricted flag in edge attributes
        if edge_data.get("restricted", False):
            violations.append(f"Segment '{u}' -> '{v}' is flagged as restricted airspace.")

        # Check congestion threshold
        cong = edge_data.get("congestion_penalty", 0.0)
        if cong > config.max_allowed_congestion:
            violations.append(f"Segment '{u}' -> '{v}' congestion ({cong}) exceeds limit ({config.max_allowed_congestion}).")

        # Check weather threshold
        wx = edge_data.get("weather_penalty", 0.0)
        if wx > config.max_allowed_weather:
            violations.append(f"Segment '{u}' -> '{v}' weather penalty ({wx}) exceeds safety limit ({config.max_allowed_weather}).")

        return ValidationResult(
            is_valid=len(violations) == 0,
            violations=violations
        )

    @classmethod
    def validate_path(
        cls,
        flight_graph: FlightGraph,
        path: List[str],
        config: ConstraintConfig
    ) -> ValidationResult:
        """Validates a complete route path against all hard constraints."""
        violations = []

        if not path or len(path) < 2:
            return ValidationResult(is_valid=False, violations=["Path must contain at least 2 nodes."])

        # Validate nodes against closed list
        for node in path:
            if node in config.closed_waypoints:
                violations.append(f"Path traverses closed waypoint '{node}'.")

        # Validate each segment in the path
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge_data = flight_graph.get_edge_data(u, v)
            if edge_data is None:
                violations.append(f"Invalid path connection: Segment '{u}' -> '{v}' does not exist.")
                continue

            edge_res = cls.validate_edge(u, v, edge_data, config)
            if not edge_res.is_valid:
                violations.extend(edge_res.violations)

        return ValidationResult(
            is_valid=len(violations) == 0,
            violations=violations
        )

    @classmethod
    def get_constrained_networkx_graph(
        cls,
        flight_graph: FlightGraph,
        config: ConstraintConfig
    ) -> nx.DiGraph:
        """
        Returns a pruned NetworkX DiGraph containing ONLY valid nodes and edges
        that satisfy all hard constraints.
        """
        valid_g = flight_graph.graph.copy()

        # Step 1: Remove closed waypoints
        for node in list(valid_g.nodes()):
            if node in config.closed_waypoints:
                valid_g.remove_node(node)

        # Step 2: Remove invalid or restricted edges
        for u, v, attrs in list(valid_g.edges(data=True)):
            val_res = cls.validate_edge(u, v, attrs, config)
            if not val_res.is_valid:
                valid_g.remove_edge(u, v)

        return valid_g

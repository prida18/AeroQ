import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import networkx as nx

from .models import FlightNode, FlightEdge, FlightNetworkData

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Great-Circle distance between two points in km."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

class FlightGraph:
    """
    Weighted directed graph representing the flight network.
    Nodes represent airports or navigational waypoints.
    Edges represent feasible flight segments with metric attributes.
    """

    def __init__(self):
        self.graph = nx.DiGraph()
        self.nodes_data: Dict[str, FlightNode] = {}

    @classmethod
    def load_from_json(cls, file_path: str | Path) -> "FlightGraph":
        """Builds a FlightGraph instance from a sample JSON file."""
        file_path = Path(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        
        network_data = FlightNetworkData(**raw_data)
        return cls.load_from_data(network_data.nodes, network_data.edges)

    @classmethod
    def load_from_data(cls, nodes: List[FlightNode], edges: List[FlightEdge]) -> "FlightGraph":
        """Builds a FlightGraph instance from list of FlightNode and FlightEdge models."""
        fg = cls()
        for node in nodes:
            fg.add_node(node)
        for edge in edges:
            fg.add_edge(edge)
        return fg

    @classmethod
    def create_dynamic_corridor(
        cls,
        origin_node: FlightNode,
        destination_node: FlightNode
    ) -> "FlightGraph":
        """
        Dynamically constructs a realistic flight network graph with multiple candidate airways 
        and navigational waypoints between ANY origin and destination airport pair.
        """
        fg = cls()
        fg.add_node(origin_node)
        fg.add_node(destination_node)

        lat1, lon1 = origin_node.latitude, origin_node.longitude
        lat2, lon2 = destination_node.latitude, destination_node.longitude
        total_dist = haversine_distance(lat1, lon1, lat2, lon2)

        # Generate 4 intermediate navigational waypoints along flight corridor
        # Corridor Alpha / Bravo (Northern sector route)
        a_node = FlightNode(
            id=f"{origin_node.id}_WAY_A",
            name=f"Waypoint Alpha ({origin_node.id}-{destination_node.id} North)",
            type="waypoint",
            latitude=round(lat1 + 0.3 * (lat2 - lat1) + 0.4, 4),
            longitude=round(lon1 + 0.3 * (lon2 - lon1) - 0.4, 4)
        )
        b_node = FlightNode(
            id=f"{origin_node.id}_WAY_B",
            name=f"Waypoint Bravo ({origin_node.id}-{destination_node.id} North)",
            type="waypoint",
            latitude=round(lat1 + 0.7 * (lat2 - lat1) + 0.2, 4),
            longitude=round(lon1 + 0.7 * (lon2 - lon1) - 0.2, 4)
        )

        # Corridor Charlie / Delta (Southern sector route)
        c_node = FlightNode(
            id=f"{origin_node.id}_WAY_C",
            name=f"Waypoint Charlie ({origin_node.id}-{destination_node.id} South)",
            type="waypoint",
            latitude=round(lat1 + 0.3 * (lat2 - lat1) - 0.4, 4),
            longitude=round(lon1 + 0.3 * (lon2 - lon1) + 0.4, 4)
        )
        d_node = FlightNode(
            id=f"{origin_node.id}_WAY_D",
            name=f"Waypoint Delta ({origin_node.id}-{destination_node.id} South)",
            type="waypoint",
            latitude=round(lat1 + 0.7 * (lat2 - lat1) - 0.2, 4),
            longitude=round(lon1 + 0.7 * (lon2 - lon1) + 0.2, 4)
        )

        for w_node in [a_node, b_node, c_node, d_node]:
            fg.add_node(w_node)

        # Helper to create FlightEdge with accurate distance
        def make_edge(u_n: FlightNode, v_n: FlightNode, wx: float = 2.0, cong: float = 3.0) -> FlightEdge:
            d_km = haversine_distance(u_n.latitude, u_n.longitude, v_n.latitude, v_n.longitude)
            return FlightEdge(
                from_node=u_n.id,
                to_node=v_n.id,
                distance_km=d_km,
                fuel_liters=round(d_km * 4.0, 2),
                co2_kg=round(d_km * 4.0 * 2.52, 2),
                weather_penalty=wx,
                congestion_penalty=cong,
                restricted=False
            )

        # Segment connections creating candidate paths
        edges = [
            make_edge(origin_node, a_node, wx=2.0, cong=8.0),
            make_edge(origin_node, c_node, wx=7.0, cong=3.0),
            make_edge(a_node, b_node, wx=3.0, cong=4.0),
            make_edge(a_node, c_node, wx=8.0, cong=2.0),
            make_edge(b_node, d_node, wx=1.0, cong=2.0),
            make_edge(b_node, destination_node, wx=5.0, cong=9.0),
            make_edge(c_node, d_node, wx=4.0, cong=6.0),
            make_edge(d_node, destination_node, wx=2.0, cong=3.0)
        ]

        for edge in edges:
            fg.add_edge(edge)

        return fg

    def add_node(self, node: FlightNode) -> None:
        """Adds a node (airport or waypoint) to the graph."""
        self.nodes_data[node.id] = node
        self.graph.add_node(
            node.id,
            name=node.name,
            type=node.type,
            latitude=node.latitude,
            longitude=node.longitude
        )

    def add_edge(self, edge: FlightEdge) -> None:
        """Adds a weighted directed edge (flight segment) to the graph."""
        self.graph.add_edge(
            edge.from_node,
            edge.to_node,
            distance_km=edge.distance_km,
            fuel_liters=edge.fuel_liters,
            co2_kg=edge.co2_kg,
            weather_penalty=edge.weather_penalty,
            congestion_penalty=edge.congestion_penalty,
            restricted=edge.restricted
        )

    def get_node(self, node_id: str) -> Optional[FlightNode]:
        """Returns metadata for a given node ID."""
        return self.nodes_data.get(node_id)

    def get_edge_data(self, u: str, v: str) -> Optional[Dict[str, Any]]:
        """Returns metadata attributes for an edge between u and v."""
        if self.graph.has_edge(u, v):
            return dict(self.graph[u][v])
        return None

    def get_all_nodes(self) -> List[str]:
        """Returns a list of all node IDs."""
        return list(self.graph.nodes())

    def get_all_edges(self) -> List[tuple[str, str, Dict[str, Any]]]:
        """Returns all edges as tuples of (u, v, attr_dict)."""
        return [(u, v, dict(attrs)) for u, v, attrs in self.graph.edges(data=True)]

    def summary(self) -> str:
        """Returns a human-readable summary of the graph structure."""
        num_nodes = self.graph.number_of_nodes()
        num_edges = self.graph.number_of_edges()
        lines = [
            f"=== AeroQ Flight Graph Summary ===",
            f"Nodes ({num_nodes}): {', '.join(self.get_all_nodes())}",
            f"Edges ({num_edges}):"
        ]
        for u, v, data in self.graph.edges(data=True):
            lines.append(
                f"  {u} -> {v}: {data['distance_km']}km | "
                f"Fuel: {data['fuel_liters']}L | CO2: {data['co2_kg']}kg | "
                f"Wx: {data['weather_penalty']} | Congestion: {data['congestion_penalty']}"
            )
        return "\n".join(lines)

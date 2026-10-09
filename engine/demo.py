from pathlib import Path
from engine.graph import FlightGraph
from engine.models import OptimizationWeights, ConstraintConfig
from engine.comparison import RouteComparator

def run_main_demo():
    sample_json = Path(__file__).parent / "data" / "sample_network.json"
    fg = FlightGraph.load_from_json(sample_json)

    origin = "DEL"
    destination = "BOM"
    aircraft = "A320"

    print("=" * 65)
    print("           AEROQ FLIGHT OPTIMIZATION ENGINE")
    print("=" * 65)
    print(f"Origin     : {origin}")
    print(f"Destination: {destination}")
    print(f"Aircraft   : {aircraft}")
    print()
    print("Generating flight network...")
    print("Applying constraints...")
    print()

    weights = OptimizationWeights(
        distance=0.20,
        fuel=0.30,
        co2=0.35,
        weather=0.10,
        congestion=0.05
    )

    comparison = RouteComparator.compare(
        flight_graph=fg,
        origin=origin,
        destination=destination,
        weights=weights,
        aircraft=aircraft
    )

    cl = comparison.classical
    q = comparison.quantum

    print("CLASSICAL OPTIMIZER")
    print(f"Algorithm : {cl.method}")
    print(f"Route     : {' -> '.join(cl.path)}")
    print(f"Distance  : {cl.total_distance_km} km")
    print(f"Fuel      : {cl.total_fuel_liters} L")
    print(f"CO2       : {cl.total_co2_kg} kg")
    print(f"Score     : {cl.total_score}")
    print(f"Time      : {cl.execution_time_ms} ms")
    print()

    print("QUANTUM OPTIMIZER")
    print(f"Method    : {q.method}")
    print(f"Route     : {' -> '.join(q.path)}")
    print(f"Distance  : {q.total_distance_km} km")
    print(f"Fuel      : {q.total_fuel_liters} L")
    print(f"CO2       : {q.total_co2_kg} kg")
    print(f"Score     : {q.total_score}")
    print(f"Qubits    : {q.qubits_used}")
    print(f"Time      : {q.execution_time_ms} ms")
    print()

    print("COMPARISON")
    print(f"Estimated CO2 Difference : {comparison.co2_difference_percent}%")
    print(f"Estimated Fuel Difference: {comparison.fuel_difference_percent}%")
    print(f"Distance Difference      : {comparison.distance_difference_percent}%")
    print(f"Summary                  : {comparison.summary_narrative}")
    print("=" * 65)

if __name__ == "__main__":
    run_main_demo()

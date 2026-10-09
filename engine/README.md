# AeroQ Optimization Engine (`engine/`)

## Overview
The **AeroQ Engine** is a hybrid classical + quantum flight trajectory optimization core. It models flight networks as weighted directed graphs, enforces airspace constraints, calculates estimated fuel burn and CO₂ emissions, and solves for lower-emission flight paths using both **Classical Dijkstra** and **Quantum QAOA (QUBO)** solvers.

---

## Architecture

```text
                    ENGINE (`engine/`)
                       │
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
       Graph       Emissions     Constraints
     (`graph.py`) (`emissions.py`) (`constraints.py`)
         │             │             │
         └─────────────┼─────────────┘
                       ↓
                Cost Function (`cost_function.py`)
                       ↓
         ┌─────────────┴─────────────┐
         ↓                           ↓
  Classical Engine            Quantum Engine
 (`classical_optimizer.py`)  (`qubo.py` + `quantum_optimizer.py`)
         ↓                           ↓
         └─────────────┬─────────────┘
                       ↓
               Result Comparison (`comparison.py`)
```

---

## Modules Breakdown

### 1. `graph.py`
- **WHAT IT DOES**: Wraps NetworkX `DiGraph` to model airports, waypoints, and flight segments.
- **WHAT GOES IN**: JSON network files (`sample_network.json`) or Pydantic data models.
- **WHAT COMES OUT**: `FlightGraph` instance exposing node and edge query methods.

### 2. `emissions.py`
- **WHAT IT DOES**: Simulates estimated fuel burn and CO₂ emissions across an expanded aircraft fleet (`A320`, `A320neo`, `B737`, `B737MAX`, `A350`, `B787`, `B777`).
- **WHAT GOES IN**: Distance (km), weather drag penalty, aircraft model key.
- **WHAT COMES OUT**: Fuel consumption (liters) and estimated CO₂ (kg).

### 3. `constraints.py`
- **WHAT IT DOES**: Hard-constraint engine that filters closed waypoints, restricted flight segments, and heavy congestion limits.
- **WHAT GOES IN**: `FlightGraph` and `ConstraintConfig`.
- **WHAT COMES OUT**: Constrained valid graph or path validation results.

### 4. `cost_function.py`
- **WHAT IT DOES**: Evaluates composite multi-objective route score based on configurable weights (`distance`, `fuel`, `co2`, `weather`, `congestion`).
- **WHAT GOES IN**: Edge metrics, aircraft profile, `OptimizationWeights`.
- **WHAT COMES OUT**: Composite numerical score and detailed `RouteCostBreakdown`.

### 5. `classical_optimizer.py`
- **WHAT IT DOES**: Minimizes composite multi-objective score using Dijkstra's shortest path algorithm.
- **WHAT GOES IN**: `FlightGraph`, origin, destination, weights, constraints, aircraft.
- **WHAT COMES OUT**: `ClassicalOptimizationResult`.

### 6. `qubo.py`
- **WHAT IT DOES**: Maps edge decisions to binary variables ($x_{u,v} \in \{0, 1\}$) and formulates a Qiskit `QuadraticProgram` with flow conservation penalties.
- **WHAT GOES IN**: Graph, origin, destination, weights, constraints.
- **WHAT COMES OUT**: `QUBOFormulation` object with binary decision matrices and route reconstruction helper.

### 7. `quantum_optimizer.py`
- **WHAT IT DOES**: Solves the QUBO energy Hamiltonian using QAOA on a local Qiskit quantum simulator.
- **WHAT GOES IN**: QUBO formulation.
- **WHAT COMES OUT**: `QuantumOptimizationResult`.

### 8. `comparison.py`
- **WHAT IT DOES**: Runs both classical and quantum solvers on identical inputs and computes side-by-side metric comparisons.
- **WHAT GOES IN**: Graph and user preferences.
- **WHAT COMES OUT**: `OptimizationComparisonResult`.

---

## How to Test
Run the console demo:
```bash
python -m engine.demo
```

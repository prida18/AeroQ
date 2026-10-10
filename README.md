# AeroQ ✈️ — Quantum Flight-Path & Emissions Optimizer

> **Quantum-enhanced flight trajectory optimization using Qiskit QAOA/QUBO algorithms & live aviation telemetry.**
>
> Check The Render Demo - https://aeroq-quantum-aviation.onrender.com/
---

## 🌟 Overview

**AeroQ** is a full-stack quantum aviation engine that optimizes international flight trajectories for minimum fuel burn, reduced CO₂ emissions, avoided weather hazards, and minimal airspace congestion.

It maps 3D airspace waypoints into a **Quadratic Unconstrained Binary Optimization (QUBO)** graph and solves it using **Qiskit QAOA (Quantum Approximate Optimization Algorithm)** & classical fallbacks.

---

## 🏗️ Architecture & Tech Stack

- **Backend / Quantum Engine (`/backend` & `/engine`)**:
  - **FastAPI**: REST API serving flight optimizations, live airport data, and weather corridors.
  - **Qiskit 1.0+**: QAOA circuit compilation, statevector simulation, and QUBO matrix generation.
  - **NetworkX & SciPy**: Spatial graph modeling and classical Dijkstra/A* baseline comparisons.
- **Frontend (`/frontend`)**:
  - **React 19 & TypeScript**: Responsive dashboard interface.
  - **Vite**: Rapid hot-reloading development server & bundled production build.
  - **Leaflet & MapLibre GL**: 2D/3D flight maps, waypoints, live weather radar, and aircraft animations.
  - **Recharts & Framer Motion**: Real-time telemetry analytics & smooth UI animations.

---

## 🔄 How Frontend & Backend Work Together

The project supports **two modes** of operation:

### 1. Development Mode (Dual Servers with API Proxy)
- **Backend**: FastAPI server running on `http://127.0.0.1:8000`
- **Frontend**: Vite dev server running on `http://localhost:3000`
- **Proxy**: Vite automatically forwards `/api/*` requests from port 3000 to port 8000 (configured in `frontend/vite.config.ts`).

### 2. Unified Production Mode (Single-Server Hackathon Deployment)
- The React frontend is compiled (`npm run build`) into `frontend/dist`.
- FastAPI mounts `frontend/dist` as static assets and serves `index.html` at `http://localhost:8000/`.
- **Result**: Running `uvicorn backend.main:app` hosts the complete application on a single port (`8000`), ideal for live hackathon demos!

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10+
- **Node.js**: 18+ and `npm`

---

### Step 1: Backend Setup

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/quantum-aviation-website.git
cd quantum-aviation-website

# 2. Create and activate a Python virtual environment
python -m venv .venv

# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Mac/Linux:
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt
```

---

### Step 2: Frontend Setup

```bash
# Navigate to frontend folder and install npm packages
cd frontend
npm install
```

---

### Step 3: Running the Application

#### Option A: Run in Development Mode (Recommended for testing)

**Terminal 1 (Backend API):**
```bash
# From project root directory
uvicorn backend.main:app --reload --port 8000
```

**Terminal 2 (Frontend UI):**
```bash
# From project root directory
cd frontend
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

#### Option B: Run in Unified Production Mode (Single Command Demo)

```bash
# 1. Build the React frontend
cd frontend
npm run build
cd ..

# 2. Start FastAPI (serves both API & Frontend)
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Open **`http://localhost:8000`** in your browser.

---

## 📤 Uploading to GitHub

To push this repository to GitHub:

```bash
# 1. Open terminal inside this project folder:
cd "c:\Users\dasab\Desktop\website\Quantum aviation Website"

# 2. Initialize git repository specifically for this project
git init -b main

# 3. Stage all files (tracked by .gitignore)
git add .

# 4. Commit files
git commit -m "feat: initial commit for AeroQ Quantum Flight Optimizer"

# 5. Link your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/quantum-aviation-website.git

# 6. Push to GitHub
git push -u origin main
```

---

## 📁 Repository Structure

```
├── backend/            # FastAPI application routes & endpoints
├── engine/             # Qiskit QAOA Quantum Circuit & QUBO Optimization engine
├── frontend/           # React 19 + TypeScript + Vite UI dashboard
│   ├── src/            # Components, Map Views & Services
│   ├── public/         # Static 3D models & assets
│   └── vite.config.ts  # Vite configuration & backend proxy rules
├── requirements.txt    # Python dependencies (Qiskit, FastAPI, NetworkX, etc.)
├── .gitignore          # Ignores node_modules, .venv, dist, etc.
└── README.md           # Project documentation
```

---

## 📜 License
Developed for Hackathon submission. Open Source under MIT License.

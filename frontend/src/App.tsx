import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import type { Airport, Aircraft, OptimizationWeights, OptimizationResponse, RouteCandidate } from './types';
import { MapTilerGlobe } from './components/MapTilerGlobe';
import { Trajectories } from './components/Trajectories';
import { SelectedTrajectory } from './components/SelectedTrajectory';
import { QaoaTuning } from './components/QaoaTuning';
import { QaoaLoader } from './components/QaoaLoader';
import { ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';

const FALLBACK_CANDIDATES: RouteCandidate[] = [
  {
    path_title: 'BOM -> BOM (Waypoint γ) -> BOM (Waypoint δ) -> DXB',
    path_nodes: ['BOM', 'BOM_WAY_C', 'BOM_WAY_D', 'DXB'],
    coordinates: [
      [72.8679, 19.0887],
      [68.5, 20.2],
      [62.3, 22.8],
      [55.3644, 25.2528],
    ],
    distance_km: 1929.74,
    fuel_liters: 6943.92,
    co2_kg: 17498.7,
    weather_penalty: 1.2,
    congestion_penalty: 0.8,
    total_score: 8658.419,
    is_quantum_optimal: true,
  },
  {
    path_title: 'BOM -> BOM (Waypoint α) -> BOM (Waypoint β) -> DXB',
    path_nodes: ['BOM', 'BOM_WAY_A', 'BOM_WAY_B', 'DXB'],
    coordinates: [
      [72.8679, 19.0887],
      [69.1, 22.4],
      [63.8, 24.1],
      [55.3644, 25.2528],
    ],
    distance_km: 1926.03,
    fuel_liters: 6948.75,
    co2_kg: 17510.86,
    weather_penalty: 1.6,
    congestion_penalty: 1.1,
    total_score: 8663.882,
    is_quantum_optimal: false,
  },
  {
    path_title: 'BOM -> BOM (Waypoint α) -> BOM (Waypoint β) -> BOM (Waypoint δ) -> DXB',
    path_nodes: ['BOM', 'BOM_WAY_A', 'BOM_WAY_B', 'BOM_WAY_D', 'DXB'],
    coordinates: [
      [72.8679, 19.0887],
      [69.1, 22.4],
      [63.8, 24.1],
      [62.3, 22.8],
      [55.3644, 25.2528],
    ],
    distance_km: 2040.98,
    fuel_liters: 7388.63,
    co2_kg: 18619.36,
    weather_penalty: 2.1,
    congestion_penalty: 1.4,
    total_score: 9241.561,
    is_quantum_optimal: false,
  },
  {
    path_title: 'BOM -> BOM (Waypoint α) -> BOM (Waypoint γ) -> BOM (Waypoint δ) -> DXB',
    path_nodes: ['BOM', 'BOM_WAY_A', 'BOM_WAY_C', 'BOM_WAY_D', 'DXB'],
    coordinates: [
      [72.8679, 19.0887],
      [69.1, 22.4],
      [68.5, 20.2],
      [62.3, 22.8],
      [55.3644, 25.2528],
    ],
    distance_km: 2159.48,
    fuel_liters: 7776.53,
    co2_kg: 19596.87,
    weather_penalty: 2.8,
    congestion_penalty: 1.9,
    total_score: 9704.12,
    is_quantum_optimal: false,
  },
];

export const App: React.FC = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);

  const [origin, setOrigin] = useState<string>('BOM');
  const [destination, setDestination] = useState<string>('DXB');
  const [aircraft, setAircraft] = useState<string>('A320');

  const [depDropdownOpen, setDepDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);

  const [weights, setWeights] = useState<OptimizationWeights>({
    co2: 0.35,
    fuel: 0.30,
    distance: 0.20,
    weather: 0.10,
    congestion: 0.05,
  });

  const [response, setResponse] = useState<OptimizationResponse | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Framer Motion smooth scroll physics for the enlarged map component
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 25,
    restDelta: 0.001,
  });

  const mapScale = useTransform(smoothProgress, [0, 0.75], [0.15, 1]);
  const mapOpacity = useTransform(smoothProgress, [0, 0.45], [0.1, 1]);

  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth momentum scrolling throughout the website
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [apRes, acRes] = await Promise.all([
          fetch('/api/airports'),
          fetch('/api/aircraft'),
        ]);

        if (apRes.ok && acRes.ok) {
          const apData: Airport[] = await apRes.json();
          const acData: Aircraft[] = await acRes.json();
          setAirports(apData);
          setAircraftList(acData);

          if (apData.length >= 2) {
            setOrigin(apData.find((a) => a.id === 'BOM')?.id || apData[0].id);
            setDestination(apData.find((a) => a.id === 'DXB')?.id || apData[1].id);
          }
        }
      } catch (err: any) {
        setError('Failed to connect to backend server: ' + err.message);
      }
    };

    fetchInitialData();
  }, []);

  const handleOptimize = async () => {
    setError(null);
    if (!origin || !destination) return;

    if (origin === destination) {
      setError('Departure and Destination airports cannot be identical.');
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          aircraft,
          weights,
          use_live_data: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Optimization failed.');
      } else {
        setResponse(data);
        setSelectedRouteIndex(null);
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 1200;
      if (elapsed < minDisplayTime) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayTime - elapsed));
      }
      setLoading(false);
    }
  };

  const isInitialMount = useRef(true);
  const prevAirportsRef = useRef({ origin: 'BOM', destination: 'DXB' });

  // Only trigger QAOA optimization when airports actually change after initial load
  useEffect(() => {
    // Skip on initial load: display instant demo data without calling server or showing loading overlay
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevAirportsRef.current = { origin, destination };
      return;
    }

    // Only run QAOA optimization when user actively changes departure or destination airport
    if (
      prevAirportsRef.current.origin !== origin ||
      prevAirportsRef.current.destination !== destination
    ) {
      prevAirportsRef.current = { origin, destination };
      handleOptimize();
    }
  }, [origin, destination]);

  // Periodic background refresh for live air traffic and weather telemetry
  useEffect(() => {
    if (!origin || !destination) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live-corridor?origin=${origin}&destination=${destination}`);
        if (res.ok) {
          const data = await res.json();
          setResponse((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              corridor_points: data.corridor_points,
              live_flights: data.live_flights,
            };
          });
        }
      } catch {
        // silent fallback
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [origin, destination]);

  // Derive coordinates for globe component
  const depAp = airports.find((a) => a.id === origin);
  const destAp = airports.find((a) => a.id === destination);

  const depLat = depAp ? depAp.latitude : 19.0887;
  const depLng = depAp ? depAp.longitude : 72.8679;
  const destLat = destAp ? destAp.latitude : 25.2528;
  const destLng = destAp ? destAp.longitude : 55.3644;

  const candidatesForGlobe =
    response?.all_candidate_routes && response.all_candidate_routes.length > 0
      ? response.all_candidate_routes
      : FALLBACK_CANDIDATES;

  const defaultOptIdx = candidatesForGlobe.findIndex((c) => c.is_quantum_optimal);
  const activeRouteIdx =
    selectedRouteIndex !== null && selectedRouteIndex < candidatesForGlobe.length
      ? selectedRouteIndex
      : defaultOptIdx >= 0
        ? defaultOptIdx
        : 0;

  const activeRoute = candidatesForGlobe[activeRouteIdx];

  const mapSectionRef = useRef<HTMLDivElement>(null);

  const scrollToEnlargedMap = () => {
    if (lenisRef.current && mapSectionRef.current) {
      lenisRef.current.scrollTo(mapSectionRef.current, { duration: 1.4 });
    } else {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToHeroTop = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 1.4 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#070d1e] via-[#0d1a38] to-[#25437e] text-white font-geist selection:bg-blue-500/30 overflow-x-hidden">
      {/* =========================================================================
          SECTION 1: HERO VIEW (SHOWN ON INITIAL LOAD AT TOP OF PAGE)
         ========================================================================= */}
      <section className="min-h-screen w-full flex flex-col justify-center items-center text-center px-6 relative z-10">
        <h1 className="text-8xl sm:text-9xl md:text-[11rem] font-extralight tracking-tight text-white select-none drop-shadow-sm font-geist">
          AeroQ
        </h1>
        <p className="text-base sm:text-lg md:text-xl font-light text-slate-300 mt-2 max-w-xl leading-relaxed tracking-wide font-geist">
          Quantum-Assisted Green Flight Path Optimizer
        </p>

        {/* Subtle scroll down cue */}
        <button
          onClick={scrollToEnlargedMap}
          className="mt-12 flex flex-col items-center gap-2 text-slate-400 hover:text-white transition group cursor-pointer"
        >
          <span className="text-xs font-light tracking-widest uppercase text-slate-400 group-hover:text-white">
            Scroll to view flight map
          </span>
          <ArrowDown size={15} className="animate-bounce text-slate-300" />
        </button>
      </section>

      {/* =========================================================================
          SECTION 2: ENLARGED FLIGHT MAP COMPONENT (ANIMATED FROM BOTTOM CENTER ANCHOR)
         ========================================================================= */}
      <section
        ref={mapSectionRef}
        className="min-h-screen w-full flex items-center justify-center p-3 sm:p-5 relative z-20 py-6"
      >
        <motion.div
          style={{
            scale: mapScale,
            opacity: mapOpacity,
            transformOrigin: 'bottom center',
          }}
          className="relative w-[98%] h-[92vh] min-h-[600px] rounded-[24px] overflow-hidden bg-slate-950 shadow-2xl border border-white/20 will-change-transform"
        >
          {/* 3D Globe WebGL Map Canvas filling the enlarged container (blurred when running QAOA circuit) */}
          <div className={`w-full h-full transition-all duration-500 ease-out ${loading ? 'filter blur-[8px] pointer-events-none scale-[1.01]' : ''}`}>
            <MapTilerGlobe
              className="w-full h-full"
              candidates={candidatesForGlobe}
              optimalRouteIndex={activeRouteIdx}
              depCoord={[depLat, depLng]}
              destCoord={[destLat, destLng]}
              depCode={origin}
              destCode={destination}
              corridorPoints={response?.corridor_points || []}
            />
          </div>

          {/* Running QAOA Circuit Loading Overlay with Monoplane Animation */}
          {loading && (
            <QaoaLoader origin={origin} destination={destination} />
          )}

          {/* Top Center Quick Back-to-Top Button when enlarged */}
          <button
            onClick={scrollToHeroTop}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-white/95 text-slate-800 shadow-xl backdrop-blur-md border border-white/50 text-xs font-light hover:bg-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronUp size={13} />
            <span>AeroQ Overview</span>
          </button>

          {/* =====================================================================
              LEFT FLOATING HUD PANEL (OVER THE LEFT SIDE OF THE MAP)
              - Qiskit QAOA Optimization Tuning
              - Selected Trajectory Component (New 2x2 grid, path pill & looping banner)
             ===================================================================== */}
          <aside
            data-lenis-prevent
            className="absolute top-5 left-5 z-30 w-[360px] max-w-[calc(100vw-3rem)] max-h-[calc(100%-2.5rem)] overflow-y-auto overscroll-contain hud-scroll flex flex-col gap-3.5 pointer-events-auto pr-1"
          >
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-3xl p-3.5 text-xs font-light shadow-xl">
                ⚠️ {error}
              </div>
            )}

            {/* Selected Trajectory Component */}
            <SelectedTrajectory
              route={activeRoute}
              optimalRoute={candidatesForGlobe[defaultOptIdx >= 0 ? defaultOptIdx : 0]}
              routeIndex={activeRouteIdx}
            />

            {/* Standalone Qiskit QAOA Tuning Component */}
            <QaoaTuning
              aircraft={aircraft}
              setAircraft={setAircraft}
              aircraftList={aircraftList}
              weights={weights}
              setWeights={setWeights}
              onOptimize={handleOptimize}
              loading={loading}
            />
          </aside>

          {/* =====================================================================
              RIGHT FLOATING PANEL (OVER THE RIGHT SIDE OF THE MAP)
              - Departure Selector Card
              - Destination Selector Card
              - Trajectories Component (Geist thin, lowercase, sliding blue selector)
             ===================================================================== */}
          <aside
            data-lenis-prevent
            className="absolute top-5 right-5 z-30 flex flex-col gap-3.5 w-80 max-w-[calc(100vw-3rem)] max-h-[calc(100%-2.5rem)] overflow-y-auto overscroll-contain hud-scroll pointer-events-auto pr-1"
          >
            {/* Departure Card - Restored Previous UI + Springy In-Flow Dropdown */}
            <div className="bg-white/95 text-slate-900 rounded-[28px] p-5 shadow-xl backdrop-blur-xl border border-white/60 font-geist transition-all duration-300 ease-out">
              <button
                onClick={() => setDepDropdownOpen(!depDropdownOpen)}
                className="w-full flex items-center justify-between font-normal text-base text-slate-700 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Select Departure</span>
                  <span className="material-symbols-outlined text-[20px] text-slate-600 select-none leading-none flex items-center justify-center">
                    flight_takeoff
                  </span>
                </div>
                <ChevronDown size={16} className={`text-slate-600 transition-transform duration-300 ${depDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">CURRENT</span>
                <div className="text-base font-semibold text-blue-600">
                  {origin} ({airports.find((a) => a.id === origin)?.name.split(' ')[0] || origin})
                </div>
              </div>

              {depDropdownOpen && (
                <div
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                  className="mt-3 pt-2.5 border-t border-slate-100 max-h-56 overflow-y-auto overscroll-contain hud-scroll flex flex-col gap-1 transition-all duration-300 ease-out"
                >
                  {airports.map((ap) => (
                    <button
                      key={ap.id}
                      onClick={() => {
                        setOrigin(ap.id);
                        setDepDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition duration-150 cursor-pointer ${origin === ap.id ? 'bg-blue-600 text-white font-medium shadow-sm' : 'hover:bg-slate-100 text-slate-700 font-normal'
                        }`}
                    >
                      <span className="font-semibold">{ap.id}</span> ({ap.name})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination Card - Restored Previous UI + Springy In-Flow Dropdown */}
            <div className="bg-white/95 text-slate-900 rounded-[28px] p-5 shadow-xl backdrop-blur-xl border border-white/60 font-geist transition-all duration-300 ease-out">
              <button
                onClick={() => setDestDropdownOpen(!destDropdownOpen)}
                className="w-full flex items-center justify-between font-normal text-base text-slate-700 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Select Destination</span>
                  <span className="material-symbols-outlined text-[20px] text-slate-600 select-none leading-none flex items-center justify-center">
                    flight_land
                  </span>
                </div>
                <ChevronDown size={16} className={`text-slate-600 transition-transform duration-300 ${destDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">TARGET</span>
                <div className="text-base font-semibold text-blue-600">
                  {destination} ({airports.find((a) => a.id === destination)?.name.split(' ')[0] || destination})
                </div>
              </div>

              {destDropdownOpen && (
                <div
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                  className="mt-3 pt-2.5 border-t border-slate-100 max-h-56 overflow-y-auto overscroll-contain hud-scroll flex flex-col gap-1 transition-all duration-300 ease-out"
                >
                  {airports.map((ap) => (
                    <button
                      key={ap.id}
                      onClick={() => {
                        setDestination(ap.id);
                        setDestDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition duration-150 cursor-pointer ${destination === ap.id ? 'bg-blue-600 text-white font-medium shadow-sm' : 'hover:bg-slate-100 text-slate-700 font-normal'
                        }`}
                    >
                      <span className="font-semibold">{ap.id}</span> ({ap.name})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trajectories Component directly below Destination component */}
            <Trajectories
              candidates={candidatesForGlobe}
              selectedIndex={activeRouteIdx}
              onSelectRoute={(idx) => setSelectedRouteIndex(idx)}
            />
          </aside>
        </motion.div>
      </section>
    </div>
  );
};

export default App;

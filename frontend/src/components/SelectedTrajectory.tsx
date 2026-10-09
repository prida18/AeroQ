import React from 'react';
import type { RouteCandidate } from '../types';

interface SelectedTrajectoryProps {
  route: RouteCandidate | null;
  optimalRoute?: RouteCandidate | null;
  routeIndex: number;
}

export const SelectedTrajectory: React.FC<SelectedTrajectoryProps> = ({
  route,
  optimalRoute,
  routeIndex,
}) => {
  if (!route) return null;

  const pathNodes =
    route.path_nodes && route.path_nodes.length > 0
      ? route.path_nodes.join(' ➔ ')
      : route.path_title || 'BOM ➔ DXB';

  const isOptimal = route.is_quantum_optimal ?? false;
  const opt = optimalRoute || (isOptimal ? route : null);

  // Formatted whole numbers with units (no decimal points)
  const co2Val = route.co2_kg ? `${Math.round(route.co2_kg).toLocaleString()} kg` : '10,012 kg';
  const fuelVal = route.fuel_liters ? `${Math.round(route.fuel_liters).toLocaleString()} L` : '6,944 L';
  const scoreVal = route.total_score ? `${Math.round(route.total_score).toLocaleString()} pts` : '8,658 pts';
  const distVal = route.distance_km ? `${Math.round(route.distance_km).toLocaleString()} km` : '1,930 km';

  // Dynamic Trend Arrow helper:
  // - Equal or lower than optimal (better/optimal performance): Green Downward Arrow ↘
  // - Higher than optimal (worse performance): Red Upward Arrow ↗
  const renderTrend = (val: number, optVal?: number) => {
    if (!optVal) {
      return (
        <svg
          className="w-4 h-4 text-[#22c55e] stroke-[2.5] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    }

    const diff = val - optVal;
    if (diff <= 0.001) {
      // Better or Equal to Optimal Path -> Green Downward Arrow
      return (
        <svg
          className="w-4 h-4 text-[#22c55e] stroke-[2.5] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    } else {
      // Worse than Optimal Path -> Red Upward Arrow
      return (
        <svg
          className="w-4 h-4 text-[#ef4444] stroke-[2.5] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 rounded-[32px] p-5 shadow-2xl border border-slate-900 flex flex-col gap-4 font-sans relative select-none">
      {/* Title with Google Material Icon AFTER the headline */}
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-2xl font-medium tracking-tight text-slate-800">
          Selected Flight Path
        </h2>
        <span className="material-symbols-outlined text-[22px] text-slate-800 select-none leading-none">
          route
        </span>
      </div>

      {/* Top Blue Pill Capsule */}
      <div className="bg-[#007eff] text-white rounded-[22px] p-3.5 px-4 flex items-center gap-3 shadow-sm">
        <span className="text-3xl font-light text-white leading-none pr-1">
          {routeIndex + 1}
        </span>
        <div className="text-xs sm:text-sm font-normal text-white leading-snug tracking-tight">
          {pathNodes}
        </div>
      </div>

      {/* 2x2 Metrics Grid with Trend Arrows for all 4 Parameters */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-2 pt-0.5">
        {/* Metric 1: CO2 Emission */}
        <div className="flex items-start gap-2.5">
          <img
            src="/icons/image 7 (1).png"
            alt="CO2"
            className="w-8 h-8 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-normal text-slate-900 tracking-tight truncate">
                {co2Val}
              </span>
              {renderTrend(route.co2_kg, opt?.co2_kg)}
            </div>
            <span className="text-[11px] font-normal text-slate-700 mt-0.5">
              CO2 Emission
            </span>
          </div>
        </div>

        {/* Metric 2: Fuel */}
        <div className="flex items-start gap-2.5">
          <img
            src="/icons/image 9.png"
            alt="Fuel"
            className="w-8 h-8 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-normal text-slate-900 tracking-tight truncate">
                {fuelVal}
              </span>
              {renderTrend(route.fuel_liters, opt?.fuel_liters)}
            </div>
            <span className="text-[11px] font-normal text-slate-700 mt-0.5">
              Fuel
            </span>
          </div>
        </div>

        {/* Metric 3: Quantum Cost Score */}
        <div className="flex items-start gap-2.5">
          <img
            src="/icons/image 8.png"
            alt="Quantum Cost"
            className="w-8 h-8 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-normal text-slate-900 tracking-tight truncate">
                {scoreVal}
              </span>
              {renderTrend(route.total_score, opt?.total_score)}
            </div>
            <span className="text-[11px] font-normal text-slate-700 mt-0.5">
              Quantum Cost Score
            </span>
          </div>
        </div>

        {/* Metric 4: Distance */}
        <div className="flex items-start gap-2.5">
          <img
            src="/icons/image 10.png"
            alt="Distance"
            className="w-8 h-8 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-normal text-slate-900 tracking-tight truncate">
                {distVal}
              </span>
              {renderTrend(route.distance_km, opt?.distance_km)}
            </div>
            <span className="text-[11px] font-normal text-slate-700 mt-0.5">
              Distance
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Neon Green Marquee Banner for Optimal Ground State Selection */}
      {isOptimal ? (
        <div className="w-full overflow-hidden bg-[#00ff1a] text-white py-2 px-2 rounded-xl font-sans text-xs font-normal tracking-wide shadow-sm mt-0.5">
          <div className="animate-marquee whitespace-nowrap flex gap-4 items-center">
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
          </div>
        </div>
      ) : (
        <div className="w-full bg-slate-100 text-slate-700 text-center py-2 px-3 rounded-xl font-sans text-xs font-normal tracking-wide mt-0.5">
          Candidate Route Option {routeIndex + 1}
        </div>
      )}
    </div>
  );
};

export default SelectedTrajectory;

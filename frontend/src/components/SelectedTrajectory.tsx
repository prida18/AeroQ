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
    <div className="w-full bg-white text-slate-900 rounded-[24px] p-4 shadow-xl border border-slate-900 flex flex-col gap-3 font-sans relative select-none">
      {/* Title with Google Material Icon AFTER the headline */}
      <div className="flex items-center justify-center gap-1.5">
        <h2 className="text-xl font-medium tracking-tight text-slate-800">
          Selected Flight Path
        </h2>
        <span className="material-symbols-outlined text-[20px] text-slate-800 select-none leading-none">
          route
        </span>
      </div>

      {/* Top Blue Pill Capsule */}
      <div className="bg-[#007eff] text-white rounded-[18px] py-2.5 px-3.5 flex items-center gap-2.5 shadow-xs">
        <span className="text-2xl font-light text-white leading-none pr-0.5">
          {routeIndex + 1}
        </span>
        <div className="text-xs font-normal text-white leading-snug tracking-tight">
          {pathNodes}
        </div>
      </div>

      {/* 2x2 Metrics Grid with Trend Arrows for all 4 Parameters */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-0.5">
        {/* Metric 1: CO2 Emission */}
        <div className="flex items-start gap-2">
          <img
            src="/icons/co2.png"
            alt="CO2"
            className="w-7 h-7 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-normal text-slate-900 tracking-tight truncate">
                {co2Val}
              </span>
              {renderTrend(route.co2_kg, opt?.co2_kg)}
            </div>
            <span className="text-[10px] font-normal text-slate-700 mt-0.5">
              CO2 Emission
            </span>
          </div>
        </div>

        {/* Metric 2: Fuel */}
        <div className="flex items-start gap-2">
          <img
            src="/icons/fuel.png"
            alt="Fuel"
            className="w-7 h-7 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-normal text-slate-900 tracking-tight truncate">
                {fuelVal}
              </span>
              {renderTrend(route.fuel_liters, opt?.fuel_liters)}
            </div>
            <span className="text-[10px] font-normal text-slate-700 mt-0.5">
              Fuel
            </span>
          </div>
        </div>

        {/* Metric 3: Quantum Cost Score */}
        <div className="flex items-start gap-2">
          <img
            src="/icons/score.png"
            alt="Quantum Cost"
            className="w-7 h-7 object-contain shrink-0 mt-0.5"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-normal text-slate-900 tracking-tight truncate">
                {scoreVal}
              </span>
              {renderTrend(route.total_score, opt?.total_score)}
            </div>
            <span className="text-[10px] font-normal text-slate-700 mt-0.5">
              Quantum Cost Score
            </span>
          </div>
        </div>

        {/* Metric 4: Distance */}
        <div className="flex items-start gap-2">
          <img
            src="/icons/distance.png"
            alt="Distance"
            className="w-7 h-7 object-contain shrink-0 mt-0.5"
          />

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-normal text-slate-900 tracking-tight truncate">
                {distVal}
              </span>
              {renderTrend(route.distance_km, opt?.distance_km)}
            </div>
            <span className="text-[10px] font-normal text-slate-700 mt-0.5">
              Distance
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Neon Green Marquee Banner for Optimal Ground State Selection */}
      {isOptimal ? (
        <div className="w-full overflow-hidden bg-[#00ff1a] text-white py-1.5 px-2 rounded-xl font-sans text-[11px] font-normal tracking-wide shadow-xs mt-0.5">
          <div className="animate-marquee whitespace-nowrap flex gap-4 items-center">
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
            <span>Qiskit Minimum Energy Ground State (Optimal) •</span>
          </div>
        </div>
      ) : (
        <div className="w-full bg-slate-100 text-slate-700 text-center py-1.5 px-3 rounded-xl font-sans text-xs font-normal tracking-wide mt-0.5">
          Candidate Route Option {routeIndex + 1}
        </div>
      )}
    </div>
  );

};

export default SelectedTrajectory;

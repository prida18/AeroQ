import React, { useState, useEffect, useRef } from 'react';
import type { RouteCandidate } from '../types';

interface TrajectoriesProps {
  candidates: RouteCandidate[];
  selectedIndex: number;
  onSelectRoute: (index: number) => void;
}

export const Trajectories: React.FC<TrajectoriesProps> = ({
  candidates,
  selectedIndex,
  onSelectRoute,
}) => {
  const [selectorStyle, setSelectorStyle] = useState<{ top: number; height: number }>({ top: 0, height: 44 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeCandidate = candidates[selectedIndex];
  const isSelectedOptimal = activeCandidate?.is_quantum_optimal ?? false;

  useEffect(() => {
    const activeEl = rowRefs.current[selectedIndex];
    if (activeEl && containerRef.current) {
      setSelectorStyle({
        top: activeEl.offsetTop,
        height: activeEl.offsetHeight,
      });
    }
  }, [selectedIndex, candidates]);

  return (
    <div className="w-full bg-white/95 text-slate-900 rounded-[24px] p-4 shadow-xl backdrop-blur-xl border border-white/60 flex flex-col font-geist transition-all duration-300 ease-out select-none">
      {/* Title with plane.png icon (Medium font weight) */}
      <div className="flex items-center justify-center gap-2 mb-2.5">
        <h2 className="text-xl font-medium tracking-tight text-slate-800">Flight Paths</h2>
        <img
          src="/icons/plane.png"
          alt="Flight Paths"
          className="w-3.5 h-3.5 object-contain"
        />
      </div>


      {/* Column Headers (Medium/Thin font weight) */}
      <div className="grid grid-cols-[38px_1fr_1.15fr_1.05fr] text-center text-slate-500 font-medium text-xs mb-2.5 px-2 gap-2">
        <span>Paths</span>
        <span>Distance (km)</span>
        <span>Est. CO₂</span>
        <span>Score</span>
      </div>

      {/* Flight Paths Table Rows with Animated Sliding Selector */}
      <div ref={containerRef} className="relative flex flex-col gap-1 py-0.5">
        {/* Animated Box Selector (Green for Quantum Optimal, Blue for Standard Candidates) */}
        {candidates.length > 0 && (
          <div
            className={`absolute left-0 right-0 rounded-2xl transition-all duration-300 ease-out shadow-sm pointer-events-none ${isSelectedOptimal ? 'bg-emerald-600' : 'bg-[#007eff]'
              }`}
            style={{
              top: `${selectorStyle.top}px`,
              height: `${selectorStyle.height}px`,
            }}
          />
        )}

        {candidates.map((c, idx) => {
          const isSelected = selectedIndex === idx;
          const isOptimal = c.is_quantum_optimal;
          const dist = Math.round(c.distance_km || 3220).toLocaleString();
          const co2 = Math.round(c.co2_kg || 3220).toLocaleString();
          const score = Math.round(c.total_score || 3220).toLocaleString();

          return (
            <div
              key={idx}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              onClick={() => onSelectRoute(idx)}
              className={`relative z-10 grid grid-cols-[38px_1fr_1.15fr_1.05fr] items-center text-center py-2.5 px-2 cursor-pointer transition-colors duration-200 gap-2 select-none ${isSelected
                ? 'text-white font-medium'
                : isOptimal
                  ? 'text-emerald-600 font-medium hover:text-emerald-700'
                  : 'text-slate-800 font-normal hover:text-slate-900'
                }`}
            >
              {/* Paths Number Column with Checkmark Icon on Left for Optimal Flight */}
              <span className="text-sm sm:text-base flex items-center justify-center gap-1 font-medium tracking-tight">
                {isOptimal && (
                  <img
                    src="/icons/check.png"
                    alt="Optimal Checkmark"
                    className="w-4 h-4 object-contain inline-block shrink-0"
                  />
                )}
                <span>{idx + 1}</span>
              </span>

              <span className="text-sm sm:text-base font-medium tracking-tight tabular-nums">{dist}</span>
              <span className="text-sm sm:text-base font-medium tracking-tight tabular-nums">{co2}</span>
              <span className="text-sm sm:text-base font-medium tracking-tight tabular-nums">{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Trajectories;

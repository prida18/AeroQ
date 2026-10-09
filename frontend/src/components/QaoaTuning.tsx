import React from 'react';
import type { Aircraft, OptimizationWeights } from '../types';
import { Atom } from 'lucide-react';

interface QaoaTuningProps {
  aircraft: string;
  setAircraft: (val: string) => void;
  aircraftList: Aircraft[];
  weights: OptimizationWeights;
  setWeights: (weights: OptimizationWeights) => void;
  onOptimize: () => void;
  loading: boolean;
}

export const QaoaTuning: React.FC<QaoaTuningProps> = ({
  aircraft,
  setAircraft,
  aircraftList,
  weights,
  setWeights,
  onOptimize,
  loading,
}) => {
  return (
    <div className="w-full bg-white text-slate-900 rounded-[24px] p-4 shadow-xl border border-slate-900 flex flex-col gap-2.5 font-sans relative select-none">
      {/* Title with Google Material Icon AFTER the headline */}
      <div className="flex items-center justify-center gap-1.5">
        <h2 className="text-xl font-medium tracking-tight text-slate-800">
          Qiskit QAOA Tuning
        </h2>
        <span className="material-symbols-outlined text-[20px] text-slate-800 select-none leading-none">
          tune
        </span>
      </div>


      {/* Aircraft Model Selector */}
      <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
        <label className="text-[11px] font-normal text-slate-600">
          Aircraft Model
        </label>
        <select
          value={aircraft}
          onChange={(e) => setAircraft(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3 py-1.5 text-xs font-normal outline-none focus:border-[#007eff] transition-colors cursor-pointer shadow-xs"
        >
          {aircraftList.length > 0 ? (
            aircraftList.map((ac) => {
              const code = ac.model_name.includes('neo')
                ? 'A320NEO'
                : ac.model_name.includes('320')
                  ? 'A320'
                  : ac.model_name.includes('MAX')
                    ? 'B737MAX'
                    : ac.model_name.includes('737')
                      ? 'B737'
                      : 'A350';
              return (
                <option key={ac.model_name} value={code}>
                  {ac.model_name}
                </option>
              );
            })
          ) : (
            <>
              <option value="A320">Airbus A320ceo</option>
              <option value="A320NEO">Airbus A320neo</option>
              <option value="B737">Boeing 737-800</option>
              <option value="B737MAX">Boeing 737 MAX 8</option>
              <option value="A350">Airbus A350-900</option>
            </>
          )}
        </select>
      </div>

      {/* Optimization Weight Sliders */}
      <div className="space-y-2 pt-0.5">
        <div>
          <div className="flex justify-between text-[11px] font-normal text-slate-600 mb-0.5">
            <span>CO₂ Emissions Weight</span>
            <span className="text-[#007eff] font-mono font-medium">
              {Math.round(weights.co2 * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.co2 * 100}
            onChange={(e) =>
              setWeights({ ...weights, co2: parseFloat(e.target.value) / 100 })
            }
            className="w-full accent-[#007eff] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-normal text-slate-600 mb-0.5">
            <span>Fuel Consumption Weight</span>
            <span className="text-[#007eff] font-mono font-medium">
              {Math.round(weights.fuel * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={weights.fuel * 100}
            onChange={(e) =>
              setWeights({ ...weights, fuel: parseFloat(e.target.value) / 100 })
            }
            className="w-full accent-[#007eff] cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* Recalculate Quantum Path Action Button */}
      <button
        onClick={onOptimize}
        disabled={loading}
        className="w-full mt-1 py-2 px-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-normal text-xs tracking-wide transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Atom size={14} className={loading ? 'animate-spin' : ''} />
        <span>
          {loading ? 'Running QAOA Circuit...' : 'Recalculate Quantum Path'}
        </span>
      </button>
    </div>
  );
};

export default QaoaTuning;

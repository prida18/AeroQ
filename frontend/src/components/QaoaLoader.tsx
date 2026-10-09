import React, { useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface QaoaLoaderProps {
  origin?: string;
  destination?: string;
}

export const QaoaLoader: React.FC<QaoaLoaderProps> = ({ origin, destination }) => {
  const [lottieSrc, setLottieSrc] = useState('/icons/Loading%2051%20_%20Monoplane.lottie');

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-md transition-all duration-300 pointer-events-auto">
      <div className="bg-white/95 text-slate-900 rounded-[32px] p-7 px-8 shadow-2xl backdrop-blur-2xl border border-white/80 flex flex-col items-center text-center max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Monoplane DotLottie Animation */}
        <div className="w-36 h-36 flex items-center justify-center overflow-hidden">
          <DotLottieReact
            src={lottieSrc}
            loop
            autoplay
            className="w-full h-full object-contain"
            onError={() => {
              setLottieSrc('/icons/monoplane-loading.lottie');
            }}
          />
        </div>

        <h3 className="text-xl font-medium tracking-tight text-slate-900 mt-2 font-geist">
          Running Qaoa circuit
        </h3>

        {origin && destination && (
          <p className="text-xs font-normal text-slate-500 mt-1 font-geist">
            Calculating optimal trajectory for {origin} ➔ {destination}
          </p>
        )}
      </div>
    </div>
  );
};

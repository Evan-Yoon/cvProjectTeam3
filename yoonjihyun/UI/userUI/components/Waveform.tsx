import React from 'react';

interface WaveformProps {
  active: boolean;
  volume: number; // 0.0 - 1.0 approx
}

export const Waveform: React.FC<WaveformProps> = ({ active, volume }) => {
  // Normalize volume for visualization
  const amplified = Math.min(1, volume * 5);

  if (!active) return null;

  return (
    <div className="flex items-center justify-center space-x-2 h-32">
      {[1, 2, 3, 4, 5].map((i) => {
        // Pseudo-random height modulation based on volume and index
        const heightPercent = Math.max(20, amplified * 100 * (Math.random() * 0.5 + 0.5));

        return (
          <div
            key={i}
            className="w-4 bg-mate-yellow rounded-full transition-all duration-100 ease-linear"
            style={{
              height: `${heightPercent}%`,
              opacity: active ? 1 : 0.3
            }}
          />
        );
      })}
    </div>
  );
};
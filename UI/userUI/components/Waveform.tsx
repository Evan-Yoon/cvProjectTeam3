import React from 'react';

interface WaveformProps {
  // active가 false면 컴포넌트를 아예 렌더링하지 않습니다.
  active: boolean;
  volume: number; // 0.0 - 1.0 approx
}

export const Waveform: React.FC<WaveformProps> = ({ active, volume }) => {
  // Normalize volume for visualization.
  // 실제 마이크 볼륨은 작은 값으로 들어올 수 있어 5배 증폭한 뒤 최대 1로 제한합니다.
  const amplified = Math.min(1, volume * 5);

  // null을 반환하면 React는 아무 DOM도 만들지 않습니다.
  if (!active) return null;

  return (
    <div className="flex items-center justify-center space-x-2 h-32">
      {[1, 2, 3, 4, 5].map((i) => {
        // Pseudo-random height modulation based on volume and index.
        // Math.random()은 렌더링마다 값이 바뀌므로 실제 오디오 분석기라기보다 간단한 시각 효과입니다.
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

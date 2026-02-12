import React, { useState, useEffect, useRef } from 'react';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from './utils/audio';
import Navigation from '@/src/utils/NavigationBridge';

// Props 인터페이스 정의
// onEndNavigation: 안내를 종료하고 싶을 때 실행할 함수 (부모 컴포넌트에서 받아옴)
interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: string; // Added destination prop
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination }) => {
  // 탭 횟수를 저장하는 State (초기값 0)
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 탭 횟수(taps)가 변할 때마다 실행되는 로직 (useEffect)
  useEffect(() => {
    // 1. 탭이 3번 이상 되면 안내 종료 함수 실행
    if (taps >= 3) {
      speak("안내를 종료합니다.");
      onEndNavigation();
    }

    // 2. 연속 탭 타이머 로직 (Reset logic)
    const timer = setTimeout(() => {
      if (taps > 0) setTaps(0);
    }, 1000);

    return () => clearTimeout(timer);
  }, [taps, onEndNavigation]);

  // Initial TTS and STT Loop
  useEffect(() => {
    isMounted.current = true;
    speak(`${destination}으로 안내를 시작합니다.`);

    // Launch Google Maps Navigation
    Navigation.startNavigation({ destination }).catch(err => {
      console.error("Navigation Error:", err);
      speak("구글 맵을 실행할 수 없습니다.");
    });

    // STT Loop to listen for "stop" commands
    const startGuidanceListening = async () => {
      // Tiny delay to not overlap with TTS
      await new Promise(r => setTimeout(r, 3000));

      if (!isMounted.current) return;

      await startListening(
        (text) => {
          const command = text.toLowerCase().trim();
          console.log("Guiding STT:", command);

          if (["안내 종료", "종료", "끝내", "stop", "end", "exit", "그만"].some(k => command.includes(k))) {
            if (isMounted.current) {
              speak("안내를 종료합니다.");
              onEndNavigation();
            }
          } else {
            // Restart listening if not a stop command
            if (isMounted.current) {
              startGuidanceListening();
            }
          }
        },
        () => {
          // Restart listening on error/silence after delay
          if (isMounted.current) {
            setTimeout(startGuidanceListening, 2000);
          }
        }
      );
    };

    startGuidanceListening();

    return () => {
      isMounted.current = false;
      stopListening();
    };
  }, [destination, onEndNavigation]);

  // 화면을 터치(클릭)했을 때 실행되는 함수
  const handleTap = () => {
    setTaps(prev => prev + 1);
  };

  return (
    <div
      className="h-full w-full bg-black flex flex-col items-center justify-center relative select-none touch-manipulation cursor-pointer overflow-hidden"
      onClick={handleTap}
    >
      {/* Background Camera Layer */}
      <div className="absolute inset-0 z-0">
        <VisionCamera />
      </div>

      {/* Overlay Content Layer (Semi-transparent black to make text readable) */}
      <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center pointer-events-none">
        {/* 중앙 메인 텍스트 영역 */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-6">
          <h1 className="text-6xl sm:text-7xl font-black leading-tight text-center tracking-tighter text-primary animate-pulse drop-shadow-lg">
            안내 중...
          </h1>
          <p className="text-2xl text-white font-bold mt-4 drop-shadow-md">{destination}</p>
        </div>

        {/* 하단 안내 문구 영역 */}
        <div className="pb-16 px-8 text-center flex flex-col gap-6">

          <p className="text-3xl md:text-4xl font-extrabold text-primary leading-tight drop-shadow-md">
            "안내 종료"라고<br />말해보세요
          </p>

          <p className="text-sm md:text-base font-medium text-white/80 leading-relaxed drop-shadow-md">
            또는 화면을 3번 탭하면 안내가 종료됩니다 ({taps}/3)
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;
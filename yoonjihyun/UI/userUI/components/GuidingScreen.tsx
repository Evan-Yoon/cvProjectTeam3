import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio'; // 경로 확인 필요
import { requestTmapWalkingPath } from '../src/api/tmap'; // 위에서 만든 API 파일 import

interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination }) => {
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 1. 탭 3번 종료 로직
  useEffect(() => {
    if (taps >= 3) {
      speak("안내를 종료합니다.");
      onEndNavigation();
    }
    const timer = setTimeout(() => {
      if (taps > 0) setTaps(0);
    }, 1000);
    return () => clearTimeout(timer);
  }, [taps, onEndNavigation]);

  // 2. TMAP 경로 탐색 및 안내 시작
  useEffect(() => {
    isMounted.current = true;

    const startNavigation = async () => {
      try {
        speak(`${destination.name}으로 경로를 탐색합니다.`);

        // (1) 내 위치 가져오기
        const position = await Geolocation.getCurrentPosition();
        const { latitude, longitude } = position.coords;

        // (2) TMAP API 호출
        const data = await requestTmapWalkingPath(
          { latitude, longitude },
          { latitude: destination.lat, longitude: destination.lng }
        );

        // (3) 경로 안내 멘트 추출 (features 배열 확인)
        if (data && data.features) {
          // 보통 features[0]은 전체 경로 개요, features[1]부터 첫 번째 이동 안내가 나옴
          const firstGuide = data.features[1]?.properties?.description;

          if (firstGuide) {
            const guideText = `경로를 찾았습니다. ${firstGuide}`;
            console.log("TMAP 안내:", guideText);
            speak(guideText);
          } else {
            speak("경로를 찾았지만 상세 안내가 없습니다.");
          }
        } else {
          speak("경로 정보를 받아오지 못했습니다.");
        }

      } catch (error) {
        console.error("Navigation Error:", error);
        speak("현재 위치를 찾거나 경로를 불러오는데 실패했습니다.");
      }
    };

    startNavigation();

    // 3. 음성 명령 인식 (STT)
    const startGuidanceListening = async () => {
      await new Promise(r => setTimeout(r, 4000)); // TTS 끝날 때까지 대기
      if (!isMounted.current) return;

      await startListening(
        (text) => {
          const command = text.toLowerCase().trim();
          console.log("Guiding STT:", command);

          if (["안내 종료", "종료", "그만", "stop", "exit"].some(k => command.includes(k))) {
            if (isMounted.current) {
              speak("안내를 종료합니다.");
              onEndNavigation();
            }
          } else {
            if (isMounted.current) startGuidanceListening();
          }
        },
        () => {
          if (isMounted.current) setTimeout(startGuidanceListening, 2000);
        }
      );
    };

    startGuidanceListening();

    return () => {
      isMounted.current = false;
      stopListening();
    };
  }, [destination, onEndNavigation]);

  return (
    <div
      className="h-full w-full bg-black flex flex-col items-center justify-center relative select-none touch-manipulation cursor-pointer overflow-hidden"
      onClick={() => setTaps(t => t + 1)}
    >
      <div className="absolute inset-0 z-0"><VisionCamera /></div>
      <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center pointer-events-none text-white">
        <h1 className="text-6xl font-black text-primary animate-pulse">안내 중...</h1>
        <p className="text-2xl font-bold mt-4">{destination.name}</p>
        <div className="mt-10 text-center">
          <p className="text-3xl font-extrabold text-primary">"안내 종료"라고 말해보세요</p>
          <p className="text-sm mt-4 opacity-80">화면 3번 탭 시 종료 ({taps}/3)</p>
        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;
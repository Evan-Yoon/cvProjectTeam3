import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio';
import { NavigationStep } from '../src/api/backend'; // ★ 백엔드 타입 import
import DebugMap from './DebugMap';

interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: { name: string; lat: number; lng: number; };
  routeData: NavigationStep[]; // ★ 추가: 백엔드에서 받은 경로 데이터
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination, routeData }) => {
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 상태 관리
  const [isOriented, setIsOriented] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);
  const [visualHeading, setVisualHeading] = useState<number | null>(null);

  // 네비게이션 변수
  const watchId = useRef<string | null>(null);
  const lastGuideIndex = useRef<number>(-1); // 현재 몇 번째 안내까지 했는지 기록
  const isSpeaking = useRef<boolean>(false);
  const prevPosition = useRef<{ lat: number; lng: number } | null>(null);
  const currentHeading = useRef<number | null>(null);

  // 헬퍼 함수: TTS
  const safeSpeak = async (text: string) => {
    if (!text || isSpeaking.current) return;
    isSpeaking.current = true;
    await speak(text);
    const waitTime = text.length < 10 ? 1500 : 2500;
    setTimeout(() => { isSpeaking.current = false; }, waitTime);
  };

  // 거리 계산 (Haversine)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 방위각 계산
  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
      Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // 3번 터치 시 종료
  useEffect(() => {
    if (taps >= 3) {
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);

  // 메인 로직
  useEffect(() => {
    isMounted.current = true;

    const startNavigation = async () => {
      try {
        setDebugMsg("GPS 추적 시작...");
        setIsLoading(false); // 이미 App.tsx에서 GPS를 잡고 오므로 바로 로딩 해제 가능

        // 실시간 위치 추적 시작
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, minimumUpdateInterval: 1000 },
          (pos, err) => {
            if (err || !pos || !isMounted.current) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;
            setVisualPos({ lat: curLat, lng: curLng });

            // 1. 방향 벡터 계산 (4미터 이동 시)
            if (prevPosition.current) {
              const movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
              if (movedDist >= 4) {
                const heading = getBearing(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
                currentHeading.current = heading;
                setVisualHeading(heading);
                prevPosition.current = { lat: curLat, lng: curLng };

                if (!isOriented) {
                  setIsOriented(true);
                  safeSpeak("방향이 확인되었습니다. 안내를 시작합니다.");
                }
              }
            } else {
              prevPosition.current = { lat: curLat, lng: curLng };
            }

            // 2. 백엔드 routeData 기반 안내 로직
            if (routeData && routeData.length > 0 && !isSpeaking.current) {
              // 현재 내 위치에서 다음 안내 지점들 확인
              for (let i = lastGuideIndex.current + 1; i < routeData.length; i++) {
                const step = routeData[i];
                const distToStep = getDistance(curLat, curLng, step.latitude, step.longitude);

                // 안내 지점 15m~20m 이내 접근 시 TTS 출력
                if (distToStep < 20) {
                  safeSpeak(step.instruction);
                  lastGuideIndex.current = i;
                  break;
                }
              }
            }

            setDebugMsg(`지점: ${lastGuideIndex.current + 1}/${routeData.length} | 방향: ${currentHeading.current?.toFixed(0) || '확인중'}°`);
          }
        );
      } catch (error) {
        console.error("Navigation Error:", error);
        setDebugMsg("안내 시작 실패");
      }
    };

    startNavigation();

    // STT (종료 명령 듣기)
    const listenLoop = async () => {
      await new Promise(r => setTimeout(r, 3000));
      if (!isMounted.current) return;
      await startListening((text) => {
        if (["종료", "그만", "정지"].some(k => text.includes(k))) {
          onEndNavigation();
        } else if (isMounted.current) {
          listenLoop();
        }
      }, () => { if (isMounted.current) setTimeout(listenLoop, 2000); });
    };
    listenLoop();

    return () => {
      isMounted.current = false;
      if (watchId.current) Geolocation.clearWatch({ id: watchId.current });
      stopListening();
    };
  }, [routeData]); // routeData가 바뀔 때마다 다시 설정

  return (
    <div className="h-full w-full bg-black flex flex-col relative" onClick={() => setTaps(t => t + 1)}>
      {/* 상단: 지도 영역 */}
      <div className="h-[50%] w-full relative z-20 border-b-2 border-white bg-gray-900">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center text-white">GPS 확인 중...</div>
        ) : (
          <DebugMap
            routeFeatures={[]} // 백엔드 데이터 포맷에 맞게 DebugMap 수정이 필요할 수 있음
            currentPos={visualPos}
            currentHeading={visualHeading}
          />
        )}
      </div>

      {/* 하단: 카메라 및 안내 UI */}
      <div className="h-[50%] w-full relative">
        <div className="absolute inset-0 z-0"><VisionCamera /></div>
        <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center text-white text-center">
          <h1 className="text-4xl font-black text-yellow-400">
            {isOriented ? "안내 중" : "방향 탐색 중"}
          </h1>
          <p className="text-2xl mt-2 font-bold">
            {lastGuideIndex.current === -1
              ? (routeData[0]?.instruction || "잠시만 기다려주세요")
              : (routeData[lastGuideIndex.current]?.instruction)}
          </p>
          <p className="text-xs mt-4 opacity-60">{debugMsg}</p>
        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;
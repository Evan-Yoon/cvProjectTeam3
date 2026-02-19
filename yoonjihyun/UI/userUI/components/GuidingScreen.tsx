import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio';
import { NavigationStep } from '../src/api/backend'; // ★ 백엔드 타입 import
import DebugMap from './DebugMap';

interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: { name: string; lat: number; lng: number; };
  routeData: NavigationStep[]; // ★ 추가: 백엔드에서 받은 경로 데이터
  routePath: { latitude: number; longitude: number }[]; // ★ [추가] 지도 그리기용 경로 좌표
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination, routeData, routePath }) => {
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 상태 관리
  const [isOriented, setIsOriented] = useState(false);
  const isOrientedRef = useRef(false); // ★ Fix: Closure issue in watchPosition

  const [debugMsg, setDebugMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);
  const [visualHeading, setVisualHeading] = useState<number | null>(null);

  // 네비게이션 변수
  const watchId = useRef<string | null>(null);
  const lastGuideIndex = useRef<number>(-1); // 현재 몇 번째 안내까지 했는지 기록
  const isSpeaking = useRef<boolean>(false);
  const prevPosition = useRef<{ lat: number; lng: number } | null>(null);
  const currentHeading = useRef<number | null>(null); // GPS Heading
  const compassHeading = useRef<number | null>(null); // Compass Heading

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

  // Compass Logic
  useEffect(() => {
    const setupCompass = async () => {
      try {
        await Motion.addListener('orientation', (data) => {
          if (data.alpha !== null) {
            // Android: alpha is 0-360 degrees (0=North, 90=East, etc.)
            // iOS: might be different, but typically alpha is compass heading
            const heading = 360 - data.alpha; // Adjust if needed based on device
            compassHeading.current = heading;
            // If GPS heading is not reliable (stopped), use compass
            if (!currentHeading.current) {
              setVisualHeading(heading);
            }

            // Initial Orientation Check with Compass
            if (!isOrientedRef.current && heading !== null) {
              // Don't speak here if we want the INITIAL route instruction to be first.
              // But user asked for "direction confirmed".
              // Let's keep it but maybe we can chain them.
              isOrientedRef.current = true;
              setIsOriented(true);
              safeSpeak("방향이 확인되었습니다.");
            }
          }
        });
      } catch (e) {
        console.error("Compass Error", e);
      }
    };
    setupCompass();

    return () => {
      Motion.removeAllListeners();
    };
  }, []);


  // 메인 로직
  useEffect(() => {
    isMounted.current = true;

    // ★ [New] Speak First Instruction Immediately
    if (routeData && routeData.length > 0) {
      // Give a small delay for "Direction confirmed" to finish if it played
      setTimeout(() => {
        safeSpeak(`안내를 시작합니다. ${routeData[0].instruction}`);
      }, 2000);
    }

    const startNavigation = async () => {
      try {
        // ★ 권한 확인 추가
        const checkPermission = await Geolocation.checkPermissions();
        if (checkPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            safeSpeak("위치 권한이 거부되었습니다.");
            return;
          }
        }

        setDebugMsg("GPS 추적 시작...");
        setIsLoading(false); // 이미 App.tsx에서 GPS를 잡고 오므로 바로 로딩 해제 가능

        // 실시간 위치 추적 시작
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0, minimumUpdateInterval: 1000 },
          (pos, err) => {
            if (err || !pos || !isMounted.current) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;
            setVisualPos({ lat: curLat, lng: curLng });

            // 1. 방향 벡터 계산 (2미터 이동 시)
            let heading = compassHeading.current; // Default to compass

            if (prevPosition.current) {
              const movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
              if (movedDist >= 2) {
                const gpsHeading = getBearing(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
                currentHeading.current = gpsHeading;
                heading = gpsHeading; // Prefer GPS when moving
                setVisualHeading(gpsHeading);
                prevPosition.current = { lat: curLat, lng: curLng };
              }
            } else {
              prevPosition.current = { lat: curLat, lng: curLng };
            }

            // Fallback visualization if not moving
            if (heading === null && compassHeading.current !== null) {
              heading = compassHeading.current;
              setVisualHeading(heading);
            }


            if (!isOrientedRef.current && heading !== null) {
              isOrientedRef.current = true;
              setIsOriented(true);
              safeSpeak("방향이 확인되었습니다.");
            }

            if (isOrientedRef.current && heading !== null) {
              // Heading Correction Logic (Clock direction)
              if (routeData && routeData.length > 0 && lastGuideIndex.current < routeData.length - 1) {
                // If we haven't started guiding yet (index -1), look at 0
                const targetIndex = lastGuideIndex.current === -1 ? 0 : lastGuideIndex.current + 1;

                if (targetIndex < routeData.length) {
                  const nextStep = routeData[targetIndex];
                  const targetBearing = getBearing(curLat, curLng, nextStep.latitude, nextStep.longitude);

                  let diff = targetBearing - heading;
                  if (diff > 180) diff -= 360;
                  if (diff < -180) diff += 360;

                  if (Math.abs(diff) > 45) {
                    const clockDir = Math.round(((diff + 360) % 360) / 30);
                    const clockStr = clockDir === 0 ? 12 : clockDir;
                    // throttle this? safeSpeak handles some overlap but maybe too chatty
                    // safeSpeak(`${clockStr}시 방향`); 
                  }
                }
              }
            }


            // 2. 백엔드 routeData 기반 안내 로직
            if (routeData && routeData.length > 0 && !isSpeaking.current) {
              const nextIndex = lastGuideIndex.current + 1;
              if (nextIndex < routeData.length) {
                const step = routeData[nextIndex];
                const distToStep = getDistance(curLat, curLng, step.latitude, step.longitude);

                // ★ [Modified] Increase radius to 30m
                // Also, if we are very close, update index and speak NEXT instruction if available?
                // or just speak THIS instruction as "Arriving"?
                // The instruction usually says "Go straight" or "Turn right".
                // If we are close to Step 0, we should complete Step 0 and look at Step 1.

                if (distToStep < 30) {
                  // We arrived at step[nextIndex]
                  // Check if there is a next step to announce
                  const nextNextIndex = nextIndex + 1;
                  if (nextNextIndex < routeData.length) {
                    const nextInstruction = routeData[nextNextIndex].instruction;
                    safeSpeak(`도착했습니다. 다음은 ${nextInstruction}`);
                  } else {
                    safeSpeak("목적지 부근입니다. 안내를 종료합니다.");
                    onEndNavigation();
                  }
                  lastGuideIndex.current = nextIndex;
                }
              }
            }

            setDebugMsg(`Step: ${lastGuideIndex.current + 1}/${routeData.length} | 헤딩: ${heading?.toFixed(0) || '확인중'}°`);
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
      await new Promise(r => setTimeout(r, 4000)); // Increased initial delay
      if (!isMounted.current) return;
      await startListening((text) => {
        if (["종료", "그만", "정지"].some(k => text.includes(k))) {
          onEndNavigation();
        } else if (isMounted.current) {
          // Success, restart loop with delay
          setTimeout(listenLoop, 1000);
        }
      }, () => {
        // Failure/End, restart loop with longer delay to reduce "ding" frequency
        if (isMounted.current) setTimeout(listenLoop, 3000);
      });
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
            path={routePath} // ★ [변경] routeFeatures=[] 대신 실제 경로 전달
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
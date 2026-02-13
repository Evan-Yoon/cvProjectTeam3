import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio';
import { requestTmapWalkingPath } from '../src/api/tmap';
import DebugMap from './DebugMap';

interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: { name: string; lat: number; lng: number; };
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination }) => {
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 상태 관리
  const [isOriented, setIsOriented] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  // ★ [추가] 지도를 그리기 위한 State (Ref는 화면 갱신이 안됨)
  const [mapFeatures, setMapFeatures] = useState<any[]>([]);
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);

  const watchId = useRef<string | null>(null);
  const routeFeatures = useRef<any[]>([]);
  const lastGuideIndex = useRef<number>(-1);
  const isSpeaking = useRef<boolean>(false);
  const targetBearingRef = useRef<number>(0);

  // GPS 벡터용 변수
  const prevPosition = useRef<{ lat: number; lng: number } | null>(null);
  const currentHeading = useRef<number | null>(null);

  // 1. 말하기 함수
  const safeSpeak = async (text: string) => {
    if (!text || isSpeaking.current) return;
    isSpeaking.current = true;
    await speak(text);
    const waitTime = text.length < 10 ? 1500 : 2500;
    setTimeout(() => { isSpeaking.current = false; }, waitTime);
  };

  // 2. 유틸리티 함수들 (변환 및 계산)
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  };

  const getAngleDiff = (target: number, current: number) => {
    let diff = target - current;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
  };

  const getClockDirection = (diff: number) => {
    if (Math.abs(diff) < 20) return 12;
    let clock = Math.round(diff / 30);
    if (clock <= 0) clock += 12;
    return clock === 0 ? 12 : clock;
  };

  // 3. 종료 로직
  useEffect(() => {
    if (taps >= 3) {
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);

  // 4. 메인 네비게이션 로직
  useEffect(() => {
    isMounted.current = true;

    const startNavigation = async () => {
      try {
        await safeSpeak("경로를 탐색합니다. 잠시만 기다려주세요.");

        // (1) 초기 위치 및 경로 데이터 수신
        const position = await Geolocation.getCurrentPosition();
        const startLat = position.coords.latitude;
        const startLng = position.coords.longitude;

        prevPosition.current = { lat: startLat, lng: startLng };
        // ★ 지도용 위치 State 업데이트
        setVisualPos({ lat: startLat, lng: startLng });

        const data = await requestTmapWalkingPath(
          { latitude: startLat, longitude: startLng },
          { latitude: destination.lat, longitude: destination.lng }
        );

        if (data && data.features) {
          routeFeatures.current = data.features.filter((f: any) => f.geometry.type === "Point");

          // ★ 지도용 경로 State 업데이트 (이게 있어야 지도가 그려짐)
          setMapFeatures(data.features);

          if (routeFeatures.current.length > 0) {
            safeSpeak("경로를 찾았습니다. 방향 확인을 위해, 전방으로 다섯 걸음만 걸어주세요.");
            const firstTarget = routeFeatures.current[1] || routeFeatures.current[0];
            const [tLng, tLat] = firstTarget.geometry.coordinates;
            targetBearingRef.current = getBearing(startLat, startLng, tLat, tLng);
          }
        }

        // (2) 실시간 위치 추적
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          (pos) => {
            if (!pos || !isMounted.current || routeFeatures.current.length === 0) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;

            // ★ 지도용 위치 State 실시간 업데이트 (빨간 점 이동)
            setVisualPos({ lat: curLat, lng: curLng });

            // 1. 이동 거리 계산
            let movedDist = 0;
            if (prevPosition.current) {
              movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
            }

            // 4미터 이상 움직였을 때만 방향 업데이트 (GPS 벡터)
            if (movedDist >= 4 && prevPosition.current) {
              const movingHeading = getBearing(
                prevPosition.current.lat, prevPosition.current.lng,
                curLat, curLng
              );

              currentHeading.current = movingHeading;
              prevPosition.current = { lat: curLat, lng: curLng };

              if (!isOriented) {
                setIsOriented(true);
                safeSpeak("방향이 확인되었습니다. 안내를 시작합니다.");
              }
            }

            setDebugMsg(`이동: ${movedDist.toFixed(1)}m / 방향: ${currentHeading.current?.toFixed(0) || '미확인'}°`);

            // 2. 경로 안내 로직
            if (isOriented && currentHeading.current !== null && !isSpeaking.current) {
              const points = routeFeatures.current;

              for (let i = lastGuideIndex.current + 1; i < points.length; i++) {
                const [targetLng, targetLat] = points[i].geometry.coordinates;
                const distance = getDistance(curLat, curLng, targetLat, targetLng);

                if (distance < 25) {
                  targetBearingRef.current = getBearing(curLat, curLng, targetLat, targetLng);
                  const diff = getAngleDiff(targetBearingRef.current, currentHeading.current);
                  const clock = getClockDirection(diff);
                  const desc = points[i].properties.description;

                  const msg = clock === 12
                    ? `전방, ${desc}`
                    : `${clock}시 방향, ${desc}`;

                  safeSpeak(msg);
                  lastGuideIndex.current = i;
                  break;
                }

                if (i + 1 < points.length) {
                  const [nLng, nLat] = points[i + 1].geometry.coordinates;
                  if (getDistance(curLat, curLng, nLat, nLng) < distance) {
                    lastGuideIndex.current = i;
                  }
                }
              }
            }
          }
        );

      } catch (error) {
        console.error("Navigation Error:", error);
        safeSpeak("위치 정보를 불러올 수 없습니다.");
      }
    };

    startNavigation();

    // STT Loop
    const startGuidanceListening = async () => {
      await new Promise(r => setTimeout(r, 4000));
      if (!isMounted.current) return;
      if (isSpeaking.current) { setTimeout(startGuidanceListening, 1000); return; }

      await startListening(
        (text) => {
          const command = text.toLowerCase().trim();
          if (["종료", "그만", "스탑"].some(k => command.includes(k))) {
            safeSpeak("안내를 종료합니다.");
            onEndNavigation();
          } else if (isMounted.current) {
            startGuidanceListening();
          }
        },
        () => { if (isMounted.current) setTimeout(startGuidanceListening, 2000); }
      );
    };
    startGuidanceListening();

    return () => {
      isMounted.current = false;
      if (watchId.current) Geolocation.clearWatch({ id: watchId.current });
      stopListening();
    };
  }, [destination]);

  // ★ 통합된 UI 렌더링 (Return은 여기 딱 하나만!)
  return (
    <div className="h-full w-full bg-black flex flex-col relative" onClick={() => setTaps(t => t + 1)}>

      {/* 1. 상단: 디버깅용 지도 (40%) */}
      <div className="h-[40%] w-full relative z-20 border-b-2 border-white">
        <DebugMap
          routeFeatures={mapFeatures} // Ref 대신 State 사용
          currentPos={visualPos}      // Ref 대신 State 사용
        />
      </div>

      {/* 2. 하단: 카메라 및 안내 UI (60%) */}
      <div className="h-[60%] w-full relative">
        <div className="absolute inset-0 z-0"><VisionCamera /></div>
        <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center text-white text-center">

          {!isOriented ? (
            <>
              <h1 className="text-4xl font-black text-yellow-400 animate-pulse">방향 탐색 중</h1>
              <p className="text-xl mt-4 font-bold">전방으로 5걸음<br />힘차게 걸어주세요</p>
              <p className="text-xs mt-2 opacity-70 bg-black/50 px-2 py-1 rounded">{debugMsg}</p>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-black text-primary">안내 중</h1>
              <p className="text-xl mt-2">{destination.name}</p>
              <p className="text-xs mt-2 opacity-70 bg-black/50 px-2 py-1 rounded">{debugMsg}</p>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;
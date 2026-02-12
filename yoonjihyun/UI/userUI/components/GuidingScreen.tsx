import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio';
import { requestTmapWalkingPath } from '../src/api/tmap';

interface GuidingScreenProps {
  onEndNavigation: () => void;
  destination: { name: string; lat: number; lng: number; };
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination }) => {
  const [taps, setTaps] = useState(0);
  const isMounted = useRef(true);

  // 상태 관리
  const [isOriented, setIsOriented] = useState(false);
  const orientationInterval = useRef<NodeJS.Timeout | null>(null);
  const targetBearingRef = useRef<number>(0);

  const watchId = useRef<string | null>(null);
  const routeFeatures = useRef<any[]>([]);
  const lastGuideIndex = useRef<number>(-1);
  const isSpeaking = useRef<boolean>(false);

  // 센서 보정용 변수
  const currentHeading = useRef<number>(0);
  const smoothHeading = useRef<number>(0);

  // 1. 말하기 함수
  const safeSpeak = async (text: string) => {
    if (!text || isSpeaking.current) return;
    isSpeaking.current = true;
    await speak(text);
    const waitTime = text.length < 10 ? 1500 : 2500;
    setTimeout(() => { isSpeaking.current = false; }, waitTime);
  };

  // 2. 각도 차이 계산
  const getAngleDiff = (target: number, current: number) => {
    let diff = target - current;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
  };

  // 3. 시계 방향 변환 (오차 범위 ±20도)
  const getClockDirection = (diff: number) => {
    if (Math.abs(diff) < 20) return 12; // 정면 인정
    let clock = Math.round(diff / 30);
    if (clock <= 0) clock += 12;
    return clock === 0 ? 12 : clock;
  };

  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  };

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

  useEffect(() => {
    if (taps >= 3) {
      if (orientationInterval.current) clearInterval(orientationInterval.current);
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);

  useEffect(() => {
    isMounted.current = true;

    // (A) 나침반 센서 (강력한 스무딩 적용)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        let heading = event.alpha;

        if (smoothHeading.current === 0) {
          smoothHeading.current = heading;
        } else {
          let diff = heading - smoothHeading.current;
          if (diff < -180) diff += 360;
          else if (diff > 180) diff -= 360;

          // ★ [수정] 0.2 -> 0.05 (아주 천천히 변하게 설정하여 떨림 방지)
          smoothHeading.current += diff * 0.05;

          if (smoothHeading.current >= 360) smoothHeading.current -= 360;
          if (smoothHeading.current < 0) smoothHeading.current += 360;
        }
        currentHeading.current = smoothHeading.current;
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);

    const startNavigation = async () => {
      try {
        await safeSpeak(`안내를 시작합니다. 방향을 확인합니다.`);

        const position = await Geolocation.getCurrentPosition();
        const startLat = position.coords.latitude;
        const startLng = position.coords.longitude;

        const data = await requestTmapWalkingPath(
          { latitude: startLat, longitude: startLng },
          { latitude: destination.lat, longitude: destination.lng }
        );

        if (data && data.features) {
          routeFeatures.current = data.features.filter((f: any) => f.geometry.type === "Point");

          if (routeFeatures.current.length > 0) {
            const firstTarget = routeFeatures.current[1] || routeFeatures.current[0];
            const [tLng, tLat] = firstTarget.geometry.coordinates;

            targetBearingRef.current = getBearing(
              startLat * Math.PI / 180, startLng * Math.PI / 180,
              tLat * Math.PI / 180, tLng * Math.PI / 180
            );

            // ★ [수정] 1초 대기 후 측정 시작 (센서 안정화)
            setTimeout(() => {
              if (!isMounted.current) return;

              // ★ [수정] 3초(3000ms) 간격으로 체크
              orientationInterval.current = setInterval(() => {
                if (!isMounted.current) return;

                const diff = getAngleDiff(targetBearingRef.current, currentHeading.current);
                const clock = getClockDirection(diff);

                console.log(`목표각도: ${targetBearingRef.current.toFixed(0)}, 현재각도: ${currentHeading.current.toFixed(0)}, 시계: ${clock}`);

                if (clock === 12) {
                  if (orientationInterval.current) clearInterval(orientationInterval.current);
                  setIsOriented(true);

                  safeSpeak("방향이 맞습니다. 전방으로 이동하세요.");

                  setTimeout(() => {
                    const firstDesc = routeFeatures.current[0].properties.description;
                    safeSpeak(firstDesc);
                    lastGuideIndex.current = 0;
                  }, 3000);

                } else {
                  // ★ 방향 안내 멘트
                  safeSpeak(`${clock}시 방향으로 도세요.`);
                }
              }, 3000); // 3초로 변경!
            }, 1000); // 시작 딜레이 1초
          }
        }

        // (B) 실시간 위치 추적
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          (pos) => {
            if (!pos || !isMounted.current || routeFeatures.current.length === 0 || isSpeaking.current) return;
            if (!isOriented) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;
            const points = routeFeatures.current;
            const toRad = (d: number) => d * Math.PI / 180;

            for (let i = lastGuideIndex.current + 1; i < points.length; i++) {
              const [targetLng, targetLat] = points[i].geometry.coordinates;
              const distance = getDistance(curLat, curLng, targetLat, targetLng);

              if (distance < 25) {
                targetBearingRef.current = getBearing(toRad(curLat), toRad(curLng), toRad(targetLat), toRad(targetLng));

                const diff = getAngleDiff(targetBearingRef.current, currentHeading.current);
                const clock = getClockDirection(diff);
                const desc = points[i].properties.description;
                const msg = clock === 12 ? `전방, ${desc}` : `${clock}시 방향, ${desc}`;

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
        );

      } catch (error) {
        console.error("Error:", error);
        safeSpeak("오류가 발생했습니다.");
      }
    };

    startNavigation();

    const startGuidanceListening = async () => { /* STT 로직 생략(기존 동일) */ };
    startGuidanceListening();

    return () => {
      isMounted.current = false;
      if (orientationInterval.current) clearInterval(orientationInterval.current);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (watchId.current) Geolocation.clearWatch({ id: watchId.current });
      stopListening();
    };
  }, [destination]);

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center relative" onClick={() => setTaps(t => t + 1)}>
      <div className="absolute inset-0 z-0"><VisionCamera /></div>
      <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center text-white text-center">
        {!isOriented ? (
          <>
            <h1 className="text-6xl font-black text-yellow-400 animate-pulse">방향 확인 중</h1>
            <p className="text-xl mt-8">3초마다 안내합니다.<br />천천히 몸을 돌리세요.</p>
          </>
        ) : (
          <>
            <h1 className="text-6xl font-black text-primary">안내 중</h1>
            <p className="text-2xl mt-4">{destination.name}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GuidingScreen;
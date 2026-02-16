import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation'; // 앱에서 GPS를 쓰기 위한 플러그인
import { Capacitor } from '@capacitor/core';
import VisionCamera from './VisionCamera';
import { speak, startListening, stopListening } from '../src/utils/audio';
import { requestTmapWalkingPath } from '../src/api/tmap';
import DebugMap from './DebugMap';

// ------------------------------------------------------------------
// 1. Props 인터페이스 정의
// 부모 컴포넌트(App.tsx 등)로부터 받아올 데이터 타입을 정의합니다.
// ------------------------------------------------------------------
interface GuidingScreenProps {
  onEndNavigation: () => void; // 안내 종료 시 실행할 함수
  destination: { name: string; lat: number; lng: number; }; // 목적지 정보
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination }) => {
  // 화면 터치 횟수 (3번 터치 시 종료 기능용)
  const [taps, setTaps] = useState(0);
  // 컴포넌트가 화면에 붙어있는지 확인 (비동기 작업 중 에러 방지)
  const isMounted = useRef(true);

  // ----------------------------------------------------------------
  // 2. 상태(State) 관리
  // ----------------------------------------------------------------
  // 사용자가 올바른 방향을 잡았는지 여부 (true면 안내 시작)
  const [isOriented, setIsOriented] = useState(false);
  // 개발용 디버그 메시지 (화면에 텍스트로 표시)
  const [debugMsg, setDebugMsg] = useState("");
  // 로딩 상태 (GPS 잡기 전까지 true로 유지)
  const [isLoading, setIsLoading] = useState(true);

  // ★ [지도 표시용 데이터]
  // TMap API에서 받아온 경로 데이터 (GeoJSON)
  const [mapFeatures, setMapFeatures] = useState<any[]>([]);
  // 지도에 표시할 내 현재 위치 (위도, 경도)
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);
  // ★ [추가] 지도에 표시할 내 바라보는 방향 (0~360도)
  const [visualHeading, setVisualHeading] = useState<number | null>(null);

  // ----------------------------------------------------------------
  // 3. 내부 변수 (Ref) - 값이 바껴도 화면이 다시 그려지지 않음 (성능 최적화)
  // ----------------------------------------------------------------
  const watchId = useRef<string | null>(null); // GPS 추적 ID (나중에 끌 때 필요)
  const routeFeatures = useRef<any[]>([]); // 경로 포인트들의 원본 배열
  const lastGuideIndex = useRef<number>(-1); // 마지막으로 안내한 경로 포인트 인덱스
  const isSpeaking = useRef<boolean>(false); // 현재 TTS가 말하고 있는지 여부
  const targetBearingRef = useRef<number>(0); // 목표 지점의 방위각

  // GPS 벡터 계산용 (이전 위치 저장)
  const prevPosition = useRef<{ lat: number; lng: number } | null>(null);
  // 현재 계산된 나의 진행 방향
  const currentHeading = useRef<number | null>(null);

  // ----------------------------------------------------------------
  // 4. 유틸리티 함수들 (TTS, 각도 계산 등)
  // ----------------------------------------------------------------
  // 안전하게 말하기 (중복 실행 방지)
  const safeSpeak = async (text: string) => {
    if (!text || isSpeaking.current) return;
    isSpeaking.current = true;
    await speak(text);
    // 문장 길이에 따라 대기 시간 조절 (짧으면 1.5초, 길면 2.5초)
    const waitTime = text.length < 10 ? 1500 : 2500;
    setTimeout(() => { isSpeaking.current = false; }, waitTime);
  };

  // 도(Degree) <-> 라디안(Radian) 변환 함수
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  // 두 좌표 간 거리 계산 (Haversine 공식, 단위: 미터)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // 지구 반지름 (미터)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 두 좌표 간 방위각(Bearing) 계산 (0: 북, 90: 동, 180: 남, 270: 서)
  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360; // 360으로 나눈 나머지 (음수 방지)
  };

  // 각도 차이 계산 (-180 ~ 180 사이로 정규화)
  // 예: 목표가 350도, 내가 10도면 차이는 -20도 (왼쪽 20도)
  const getAngleDiff = (target: number, current: number) => {
    let diff = target - current;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    return diff;
  };

  // 각도 차이를 시계 방향(Clock Position)으로 변환
  // 예: 0도 -> 12시, 90도 -> 3시
  const getClockDirection = (diff: number) => {
    if (Math.abs(diff) < 20) return 12; // 20도 이내는 전방(12시)
    let clock = Math.round(diff / 30);
    if (clock <= 0) clock += 12;
    return clock === 0 ? 12 : clock;
  };

  // GPS 에러 메시지 처리 헬퍼
  const getLocationErrorMessage = (error: unknown) => {
    if (!error || typeof error !== 'object') return '알 수 없는 오류';
    const maybeError = error as { code?: string; message?: string };
    if (maybeError.code && maybeError.message) return `${maybeError.code}: ${maybeError.message}`;
    return maybeError.message || '알 수 없는 오류';
  };

  // GPS 권한 체크 및 요청 함수
  const ensureLocationPermission = async () => {
    const permission = await Geolocation.checkPermissions();
    const isGranted = permission.location === 'granted' || permission.coarseLocation === 'granted';
    if (isGranted) return true;

    const requested = await Geolocation.requestPermissions();
    const granted = requested.location === 'granted' || requested.coarseLocation === 'granted';
    return granted;
  };

  // ----------------------------------------------------------------
  // 5. 종료 로직 (화면 3번 터치 시)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (taps >= 3) {
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    // 1초 안에 연타하지 않으면 횟수 초기화
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);

  // ----------------------------------------------------------------
  // 6. ★ 핵심 네비게이션 로직 (GPS + TMap + 벡터 계산)
  // ----------------------------------------------------------------
  useEffect(() => {
    isMounted.current = true;

    const startNavigation = async () => {
      try {
        await safeSpeak("GPS 신호를 찾고 있습니다. 잠시만 기다려주세요.");

        // 웹 브라우저 환경에서 HTTPS 체크 (보안 정책 때문)
        if (!Capacitor.isNativePlatform()) {
          const isSecureContextForWeb =
            typeof window !== 'undefined' &&
            (window.isSecureContext || window.location.hostname === 'localhost');

          if (!isSecureContextForWeb) {
            setIsLoading(false);
            setDebugMsg("웹에서는 HTTPS(또는 localhost)에서만 GPS가 동작합니다.");
            await safeSpeak("웹에서는 HTTPS 환경에서만 위치를 가져올 수 있습니다.");
            return;
          }
        }

        // 권한 체크
        const hasLocationPermission = await ensureLocationPermission();
        if (!hasLocationPermission) {
          setIsLoading(false);
          setDebugMsg("위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해주세요.");
          await safeSpeak("위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.");
          return;
        }

        setDebugMsg("GPS 초기 위치 확인 중...");

        // (1) 초기 위치 잡기 (정확도 높게 시도 -> 실패 시 낮게 재시도)
        let position;
        try {
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        } catch (highAccuracyError) {
          console.warn("High accuracy GPS failed. Retry with lower accuracy.", highAccuracyError);
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 10000
          });
        }

        const startLat = position.coords.latitude;
        const startLng = position.coords.longitude;

        // ★ 위치를 잡았으므로 로딩 해제
        prevPosition.current = { lat: startLat, lng: startLng };
        setVisualPos({ lat: startLat, lng: startLng });
        setIsLoading(false); // 로딩 끝! 지도 표시 시작

        // (2) TMAP 경로 요청
        await safeSpeak("위치가 확인되었습니다. 경로를 탐색합니다.");

        const data = await requestTmapWalkingPath(
          { latitude: startLat, longitude: startLng },
          { latitude: destination.lat, longitude: destination.lng }
        );

        if (data && data.features) {
          // Point 타입(경유지, 도착지 등)만 필터링해서 저장
          routeFeatures.current = data.features.filter((f: any) => f.geometry.type === "Point");
          setMapFeatures(data.features); // 전체 경로는 지도에 그리기 위해 저장

          if (routeFeatures.current.length > 0) {
            safeSpeak("경로를 찾았습니다. 방향 확인을 위해, 전방으로 다섯 걸음만 걸어주세요.");
            // 첫 번째 목표 지점 설정
            const firstTarget = routeFeatures.current[1] || routeFeatures.current[0];
            const [tLng, tLat] = firstTarget.geometry.coordinates;
            targetBearingRef.current = getBearing(startLat, startLng, tLat, tLng);
          }
        }

        // (3) 실시간 위치 추적 시작 (watchPosition)
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, minimumUpdateInterval: 1000 },
          (pos, err) => {
            if (err) {
              setDebugMsg(`GPS 추적 오류: ${getLocationErrorMessage(err)}`);
              return;
            }
            if (!pos || !isMounted.current || routeFeatures.current.length === 0) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;

            // 지도에 내 위치 점 업데이트
            setVisualPos({ lat: curLat, lng: curLng });

            // 이동 거리 계산 (이전 위치 기준)
            let movedDist = 0;
            if (prevPosition.current) {
              movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
            }

            // ★ [핵심] 4미터 이상 움직였을 때만 방향 업데이트 (GPS 벡터 방식)
            // 나침반 센서 대신 이동 궤적을 이용해 방향을 계산합니다.
            if (movedDist >= 4 && prevPosition.current) {
              const movingHeading = getBearing(
                prevPosition.current.lat, prevPosition.current.lng,
                curLat, curLng
              );

              currentHeading.current = movingHeading;
              // ★ 지도에 표시할 방향 화살표 업데이트
              setVisualHeading(movingHeading);

              prevPosition.current = { lat: curLat, lng: curLng };

              if (!isOriented) {
                setIsOriented(true); // 방향 찾음! 안내 시작
                safeSpeak("방향이 확인되었습니다. 안내를 시작합니다.");
              }
            }

            setDebugMsg(`이동: ${movedDist.toFixed(1)}m / 방향: ${currentHeading.current?.toFixed(0) || '미확인'}°`);

            // 경로 안내 로직 (방향을 찾은 이후부터 동작)
            if (isOriented && currentHeading.current !== null && !isSpeaking.current) {
              const points = routeFeatures.current;

              for (let i = lastGuideIndex.current + 1; i < points.length; i++) {
                const [targetLng, targetLat] = points[i].geometry.coordinates;
                const distance = getDistance(curLat, curLng, targetLat, targetLng);

                // 목표 지점 25m 이내 접근 시 안내 멘트 발송
                if (distance < 25) {
                  targetBearingRef.current = getBearing(curLat, curLng, targetLat, targetLng);
                  const diff = getAngleDiff(targetBearingRef.current, currentHeading.current);
                  const clock = getClockDirection(diff);
                  const desc = points[i].properties.description;

                  // 12시면 "전방", 아니면 "N시 방향" 안내
                  const msg = clock === 12
                    ? `전방, ${desc}`
                    : `${clock}시 방향, ${desc}`;

                  safeSpeak(msg);
                  lastGuideIndex.current = i; // 해당 포인트 안내 완료 처리
                  break;
                }

                // 다음 포인트가 더 가까우면 현재 포인트 건너뛰기 (유연한 안내)
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
        // 에러 처리
        const errorText = getLocationErrorMessage(error);
        console.error("Navigation Error:", error);
        setDebugMsg(`GPS 오류: ${errorText}`);

        if (errorText.toLowerCase().includes("permission")) {
          safeSpeak("위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.");
        } else {
          safeSpeak("위치 정보를 불러올 수 없습니다. 실외로 이동하거나 GPS를 켜주세요.");
        }
        setIsLoading(false); // 에러나도 로딩 화면은 꺼야 디버깅 가능
      }
    };

    startNavigation();

    // 음성 명령(STT) 루프 시작
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
            startGuidanceListening(); // 계속 듣기
          }
        },
        () => { if (isMounted.current) setTimeout(startGuidanceListening, 2000); } // 에러 시 재시도
      );
    };
    startGuidanceListening();

    // 컴포넌트 해제 시 정리(Cleanup) 함수
    return () => {
      isMounted.current = false;
      if (watchId.current) Geolocation.clearWatch({ id: watchId.current });
      stopListening();
    };
  }, [destination]);

  return (
    <div className="h-full w-full bg-black flex flex-col relative" onClick={() => setTaps(t => t + 1)}>

      {/* 1. 상단: 디버깅용 지도 (★ 높이 50%로 변경) */}
      <div className="h-[50%] w-full relative z-20 border-b-2 border-white bg-gray-900">
        {isLoading ? (
          // 로딩 중 화면
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-yellow-400 mb-4"></div>
            <p className="text-lg font-bold">GPS 신호 찾는 중...</p>
            <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요</p>
          </div>
        ) : (
          // 지도 화면 (props 전달: 경로, 현재 위치, ★현재 방향)
          <DebugMap
            routeFeatures={mapFeatures}
            currentPos={visualPos}
            currentHeading={visualHeading}
          />
        )}
      </div>

      {/* 2. 하단: 카메라 및 안내 UI (★ 높이 50%로 변경) */}
      <div className="h-[50%] w-full relative">
        <div className="absolute inset-0 z-0"><VisionCamera /></div>
        <div className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center text-white text-center">

          {!isOriented ? (
            // 방향 탐색 중일 때 UI
            <>
              <h1 className="text-4xl font-black text-yellow-400 animate-pulse">방향 탐색 중</h1>
              <p className="text-xl mt-4 font-bold">전방으로 5걸음<br />힘차게 걸어주세요</p>
              <p className="text-xs mt-2 opacity-70 bg-black/50 px-2 py-1 rounded">{debugMsg}</p>
            </>
          ) : (
            // 정상 안내 중일 때 UI
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
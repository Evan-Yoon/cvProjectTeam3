import React, { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation'; // GPS 위치 정보
import { Motion } from '@capacitor/motion'; // 나침반(자이로스코프) 센서
import VisionCamera from './VisionCamera'; // 카메라 화면
import { speak, startListening, stopListening } from '../src/utils/audio'; // 음성(TTS/STT)
import { NavigationStep } from '../src/api/backend'; // 백엔드 데이터 타입
import DebugMap from './DebugMap'; // 지도 컴포넌트

// ------------------------------------------------------------------
// 0. 설정 상수 (기기마다 나침반 편차가 있을 때 수정)
// ------------------------------------------------------------------
// 만약 북쪽을 보는데 화살표가 동쪽을 가리키면 -90 또는 90으로 조절해보세요.
const COMPASS_OFFSET = 0;

// ------------------------------------------------------------------
// 1. Props 인터페이스 정의
// ------------------------------------------------------------------
interface GuidingScreenProps {
  onEndNavigation: () => void; // 안내 종료 함수
  destination: { name: string; lat: number; lng: number; }; // 목적지 정보
  routeData: NavigationStep[]; // 백엔드에서 받은 경로 데이터 (안내 멘트용)
  routePath: { latitude: number; longitude: number }[]; // 지도에 그릴 경로 좌표 (선 그리기용)
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination, routeData, routePath }) => {

  // ----------------------------------------------------------------
  // 2. 상태(State) 관리 - 화면 렌더링에 영향을 줌
  // ----------------------------------------------------------------
  const [taps, setTaps] = useState(0); // 화면 터치 횟수 (3번 터치 종료용)
  const [isOriented, setIsOriented] = useState(false); // 방향을 잡았는지 여부
  const [debugMsg, setDebugMsg] = useState(""); // 개발용 디버그 텍스트
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태

  // 지도에 표시할 내 위치와 방향
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);
  const [visualHeading, setVisualHeading] = useState<number | null>(null); // ★ 화살표 방향 (나침반 기준)

  // ----------------------------------------------------------------
  // 3. 내부 변수 (Ref) - 값이 바뀌어도 화면이 깜빡이지 않음 (고성능 처리용)
  // ----------------------------------------------------------------
  const isMounted = useRef(true); // 컴포넌트가 살아있는지 체크
  const watchId = useRef<string | null>(null); // GPS 추적 ID
  const lastGuideIndex = useRef<number>(-1); // 마지막으로 안내한 경로 번호
  const isSpeaking = useRef<boolean>(false); // 지금 말하고 있는지 (중복 방지)

  const prevPosition = useRef<{ lat: number; lng: number } | null>(null); // 직전 위치 (이동거리 계산용)
  const currentHeading = useRef<number | null>(null); // GPS로 계산한 이동 방향
  const compassHeading = useRef<number | null>(null); // 나침반 센서값 저장용
  const isOrientedRef = useRef(false); // useState의 비동기 문제 해결용 Ref

  // ----------------------------------------------------------------
  // 4. 유틸리티 함수들 (거리 계산, 각도 계산)
  // ----------------------------------------------------------------

  interface TtsMessage {
    text: string;
    isObstacle: boolean;
  }
  const ttsQueue = useRef<TtsMessage[]>([]);

  // TTS 큐 처리: 쌓인 안내를 차례대로 말하되 장애물이면 우선 재생
  const processTtsQueue = async () => {
    if (isSpeaking.current || ttsQueue.current.length === 0) return;
    isSpeaking.current = true;

    // 우선순위에 따라 다음 메시지 찾기 (장애물이 가장 먼저)
    const obstacleIndex = ttsQueue.current.findIndex(m => m.isObstacle);
    const indexToPlay = obstacleIndex !== -1 ? obstacleIndex : 0;
    const msg = ttsQueue.current.splice(indexToPlay, 1)[0];

    await speak(msg.text);

    // 문장 길이에 비례하여 충분한 대기 시간 설정 (기본 최소 1.5초 ~)
    const waitTime = Math.max(1500, msg.text.length * 150);
    setTimeout(() => {
      isSpeaking.current = false;
      processTtsQueue(); // 다음 대기열 재생
    }, waitTime);
  };

  // 모든 멘트를 큐에 넣기 (기존처럼 말하는 중이라고 무시하지 않음)
  const safeSpeak = (text: string, isObstacle: boolean = false) => {
    if (!text) return;

    // 똑같은 멘트가 큐에 중복으로 수십 개 쌓이는 것만 방지
    if (ttsQueue.current.some(m => m.text === text && m.isObstacle === isObstacle)) return;

    ttsQueue.current.push({ text, isObstacle });
    processTtsQueue();
  };

  // 두 좌표 사이의 거리 계산 (Haversine 공식 - 지구 곡면 반영)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 결과: 미터(m) 단위
  };

  // 두 좌표 사이의 방위각 계산 (북쪽 0도 기준)
  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
      Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // ----------------------------------------------------------------
  // 5. 종료 로직 (화면 3번 터치 시)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (taps >= 3) {
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    // 1초 안에 3번 안 치면 초기화
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);

  // ----------------------------------------------------------------
  // 6. ★ 핵심: 나침반(Compass) 센서 로직 (화살표 방향 제어)
  // ----------------------------------------------------------------
  useEffect(() => {
    let lastSmoothedHeading: number | null = null;
    const LPF_ALPHA = 0.15; // 낮을수록 부드럽지만 반응 지연, 높을수록 빠르지만 떨림 (0.1 ~ 0.3 추천)

    const setupCompass = async () => {
      try {
        // iOS 13 이상을 위한 권한 요청 (안드로이드는 자동 통과됨)
        if ((DeviceMotionEvent as any).requestPermission) {
          const response = await (DeviceMotionEvent as any).requestPermission();
          if (response !== 'granted') return;
        }

        // 브라우저 네이티브 이벤트 'deviceorientationabsolute'가 가장 정밀함
        // iOS Safari는 'deviceorientation' 이벤트 내 webkitCompassHeading 프로퍼티 지원
        // Capacitor Motion은 브라우저 엔진에 의존.
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);

      } catch (e) {
        console.error("Compass Error", e);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let rawHeading = 0;
      let validData = false;

      // 1. iOS 전용: 기울기를 3차원으로 보정해주는 하드웨어 나침반 (가장 정확함)
      if (typeof (event as any).webkitCompassHeading !== "undefined") {
        rawHeading = (event as any).webkitCompassHeading;
        validData = true;
      }
      // 2. Android (Chromium): 절대 방위각 (지구 북극 기준 Z 회전)
      else if (event.absolute && event.alpha !== null) {
        // 안드로이드의 alpha 값은 시계 반대방향(CCW)일 때가 많아 360에서 빼줌
        rawHeading = 360 - event.alpha;
        validData = true;
      }

      if (!validData) return;

      // 나침반 보정값 적용 (기기별 오차 수정)
      let currentHeading = (rawHeading + COMPASS_OFFSET) % 360;
      if (currentHeading < 0) currentHeading += 360;

      // 3. 저역 통과 필터(LPF) 적용 및 360도 경계선 최단거리 보간 로직
      if (lastSmoothedHeading === null) {
        lastSmoothedHeading = currentHeading; // 첫 값은 그대로 적용
      } else {
        // 현재 각도와 이전 각도의 차이 구하기 (-180 ~ +180 범위로 정규화)
        let diff = currentHeading - lastSmoothedHeading;
        diff = ((diff + 540) % 360) - 180;

        // 부드럽게 새 각도 반영 (기존 각도에 차이값의 일정 비율만 더함)
        lastSmoothedHeading = lastSmoothedHeading + LPF_ALPHA * diff;

        // 다시 0~360 사이로 보정
        lastSmoothedHeading = (lastSmoothedHeading + 360) % 360;
      }

      compassHeading.current = lastSmoothedHeading;
      setVisualHeading(lastSmoothedHeading);

      // 처음 방향을 잡았을 때 멘트
      if (!isOrientedRef.current && lastSmoothedHeading !== null) {
        isOrientedRef.current = true;
        setIsOriented(true);
      }
    };

    setupCompass();

    // 컴포넌트 꺼질 때 센서 끄기
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // ----------------------------------------------------------------
  // 7. ★ 핵심: 네비게이션 로직 (GPS + 경로 안내)
  // ----------------------------------------------------------------
  useEffect(() => {
    isMounted.current = true;

    // 안내 시작 멘트 (2초 뒤 실행)
    if (routeData && routeData.length > 0) {
      setTimeout(() => {
        safeSpeak(`안내를 시작합니다. ${routeData[0].instruction}`);
      }, 2000);
    }

    const startNavigation = async () => {
      try {
        // 위치 권한 재확인
        const checkPermission = await Geolocation.checkPermissions();
        if (checkPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            safeSpeak("위치 권한이 거부되었습니다.");
            return;
          }
        }

        setDebugMsg("GPS 추적 시작...");

        // 1. 초기 위치 즉시 확보 (Watch가 느릴 수 있으므로)
        try {
          const initialPos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
          if (initialPos && initialPos.coords) {
            const { latitude, longitude } = initialPos.coords;
            setVisualPos({ lat: latitude, lng: longitude });
            prevPosition.current = { lat: latitude, lng: longitude };
            setDebugMsg("초기 위치 확보 완료");
          }
        } catch (e) {
          console.warn("초기 위치 실패 (Watch로 계속 시도)", e);
        }

        setIsLoading(false);

        // 2. 실시간 위치 추적 (WatchPosition)
        watchId.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true, // 배터리보다 정확도 우선
            timeout: 10000,
            maximumAge: 0,
            minimumUpdateInterval: 1000 // 1초마다 업데이트 (더 빠르게)
          },
          (pos, err) => {
            if (err) {
              console.error("GPS Watch Error:", err);
              setDebugMsg(`GPS 에러: ${err.message}`);
              return;
            }
            if (!pos || !isMounted.current) return;

            const curLat = pos.coords.latitude;
            const curLng = pos.coords.longitude;

            // 지도에 내 위치(점) 업데이트
            setVisualPos({ lat: curLat, lng: curLng });

            // 이동 거리 계산 (2m 이상 움직였는지 체크)
            if (prevPosition.current) {
              const movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);

              if (movedDist >= 2) {
                // 실제 이동 방향(GPS Course) 계산 -> 경로 이탈 로직에만 사용
                const gpsHeading = getBearing(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);
                currentHeading.current = gpsHeading;

                // ★ [수정됨] 여기서 setVisualHeading(gpsHeading)을 하지 않습니다!
                // 화살표는 오직 나침반(Compass)만 믿습니다.

                prevPosition.current = { lat: curLat, lng: curLng };
              }
            } else {
              prevPosition.current = { lat: curLat, lng: curLng };
            }

            // ----------------------------------------------------------
            // 경로 안내 로직 (다음 지점까지 거리 체크 및 스킵 처리)
            // ----------------------------------------------------------
            if (routeData && routeData.length > 0 && !isSpeaking.current) {
              const nextIndex = lastGuideIndex.current + 1;

              if (nextIndex < routeData.length) {
                // 사용자가 체크포인트를 건너뛰었을(bypass/skip) 가능성을 고려하여,
                // 현재 위치에서 반경 15m 이내에 들어온 가장 먼(미래의) 체크포인트를 찾습니다.
                let reachedIndex = -1;
                for (let i = routeData.length - 1; i >= nextIndex; i--) {
                  const dist = getDistance(curLat, curLng, routeData[i].latitude, routeData[i].longitude);
                  if (dist < 15) { // 스킵 판정을 위해 기존 10m에서 15m로 약간 완화
                    reachedIndex = i;
                    break;
                  }
                }

                // 목표 지점 중 하나에 진입 시
                if (reachedIndex !== -1) {
                  // 다음 안내 멘트 준비
                  const nextNextIndex = reachedIndex + 1;

                  if (nextNextIndex < routeData.length) {
                    const nextInstruction = routeData[nextNextIndex].instruction;
                    // 만약 여러 단계를 건너뛰었다면 "경로를 건너뛰었습니다." 등의 멘트를 추가할 수도 있지만,
                    // 자연스럽게 이어서 안내합니다.
                    safeSpeak(`이어서, ${nextInstruction}`);
                  } else {
                    safeSpeak("목적지 부근입니다. 안내를 종료합니다.");
                    onEndNavigation();
                  }

                  // 현재 단계 완료 처리 (스킵된 단계들 포함하여 업데이트)
                  lastGuideIndex.current = reachedIndex;
                }
              }

              // 화면 하단 디버그 메시지 업데이트 (남은 거리 표시 추가)
              const distToNext = (nextIndex < routeData.length)
                ? getDistance(curLat, curLng, routeData[nextIndex].latitude, routeData[nextIndex].longitude).toFixed(1)
                : "0";

              setDebugMsg(`지점: ${lastGuideIndex.current + 1}/${routeData.length} | 다음: ${distToNext}m | 나침반: ${compassHeading.current?.toFixed(0) || 0}°`);
            } else {
              setDebugMsg(`경로 완료 | 나침반: ${compassHeading.current?.toFixed(0) || 0}°`);
            }
          }
        );
      } catch (error) {
        console.error("Navigation Error:", error);
        setDebugMsg("안내 시작 실패");
      }
    };

    startNavigation();

    // ----------------------------------------------------------
    // 음성 인식 (STT) - "종료"라고 말하면 꺼지는 기능
    // ----------------------------------------------------------
    const listenLoop = async () => {
      await new Promise(r => setTimeout(r, 4000));
      if (!isMounted.current) return;

      await startListening((text) => {
        if (["종료", "그만", "정지"].some(k => text.includes(k))) {
          onEndNavigation();
        } else if (isMounted.current) {
          setTimeout(listenLoop, 1000); // 계속 듣기
        }
      }, () => {
        if (isMounted.current) setTimeout(listenLoop, 3000); // 에러나면 3초 뒤 재시도
      });
    };
    listenLoop();

    // 컴포넌트 사라질 때 정리(Cleanup)
    return () => {
      isMounted.current = false;
      if (watchId.current) Geolocation.clearWatch({ id: watchId.current });
      stopListening();
    };
  }, [routeData]); // routeData가 바뀌면 다시 실행

  return (
    <div className="h-full w-full bg-black flex flex-col relative" onClick={() => setTaps(t => t + 1)}>

      {/* 1. 상단: 지도 영역 (50%) */}
      <div className="h-[50%] w-full relative z-20 border-b-2 border-white bg-gray-900">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white mr-2"></div>
            GPS 확인 중...
          </div>
        ) : (
          <DebugMap
            path={routePath}        // 지도에 그릴 전체 경로 선
            currentPos={visualPos}  // 내 현재 위치 (점)
            currentHeading={visualHeading} // 내 시선 방향 (화살표)
          />
        )}
      </div>

      {/* 2. 하단: 카메라 및 안내 텍스트 (50%) */}
      <div className="h-[50%] w-full relative">
        {/* 카메라 화면 (배경) */}
        <div className="absolute inset-0 z-0"><VisionCamera onSpeak={safeSpeak} /></div>

        {/* 반투명 검은 배경 위 텍스트 */}
        <div className="absolute inset-0 z-10 bg-black/50 flex flex-col items-center justify-center text-white text-center p-4">
          <h1 className="text-4xl font-black text-yellow-400 mb-4">
            {isOriented ? "안내 중" : "방향 탐색 중"}
          </h1>

          <p className="text-2xl font-bold leading-relaxed">
            {lastGuideIndex.current === -1
              ? (routeData[0]?.instruction || "잠시만 기다려주세요")
              : (routeData[lastGuideIndex.current]?.instruction)}
          </p>

          <p className="text-xs mt-6 opacity-60 bg-black/30 px-2 py-1 rounded">
            {debugMsg}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;
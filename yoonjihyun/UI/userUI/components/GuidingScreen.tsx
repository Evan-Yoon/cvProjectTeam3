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

  // 안전하게 말하기 (말하는 중이면 무시)
  const safeSpeak = async (text: string) => {
    if (!text || isSpeaking.current) return;
    isSpeaking.current = true;
    await speak(text);
    // 문장이 길면 더 오래 대기 (짧으면 1.5초, 길면 2.5초)
    const waitTime = text.length < 10 ? 1500 : 2500;
    setTimeout(() => { isSpeaking.current = false; }, waitTime);
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
    const setupCompass = async () => {
      try {
        // iOS 13 이상을 위한 권한 요청 (안드로이드는 자동 통과됨)
        if ((DeviceMotionEvent as any).requestPermission) {
          const response = await (DeviceMotionEvent as any).requestPermission();
          if (response !== 'granted') return;
        }

        // 센서 데이터 리스너 등록
        await Motion.addListener('orientation', (data) => {
          // data.alpha: Z축 기준 회전각 (0~360도)
          let heading = data.alpha || 0;

          // ★ [중요] 안드로이드/iOS 차이 보정
          // 만약 화살표가 내가 도는 반대 방향으로 돈다면 아래 식을 사용하세요.
          heading = 360 - heading;

          // 나침반 보정값 적용 (기기별 오차 수정)
          heading = (heading + COMPASS_OFFSET) % 360;
          if (heading < 0) heading += 360;

          compassHeading.current = heading;

          // ★ [수정됨] GPS 이동과 상관없이, 화살표는 무조건 나침반을 따릅니다.
          // 사용자가 제자리에서 고개를 돌리면 화살표도 즉시 돌아갑니다.
          setVisualHeading(heading);

          // 처음 방향을 잡았을 때 멘트
          if (!isOrientedRef.current && heading !== null) {
            isOrientedRef.current = true;
            setIsOriented(true);
            // safeSpeak("방향 센서가 활성화되었습니다."); // 너무 말이 많으면 주석 처리
          }
        });
      } catch (e) {
        console.error("Compass Error", e);
      }
    };

    setupCompass();

    // 컴포넌트 꺼질 때 센서 끄기
    return () => {
      Motion.removeAllListeners();
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
            // 경로 안내 로직 (다음 지점까지 거리 체크)
            // ----------------------------------------------------------
            if (routeData && routeData.length > 0 && !isSpeaking.current) {
              const nextIndex = lastGuideIndex.current + 1;

              if (nextIndex < routeData.length) {
                const step = routeData[nextIndex];
                const distToStep = getDistance(curLat, curLng, step.latitude, step.longitude);

                // 목표 지점 반경 10m 이내 진입 시 (더 정밀하게 수정)
                if (distToStep < 10) {
                  // 다음 안내 멘트 준비
                  const nextNextIndex = nextIndex + 1;

                  if (nextNextIndex < routeData.length) {
                    const nextInstruction = routeData[nextNextIndex].instruction;
                    safeSpeak(`이어서, ${nextInstruction}`);
                  } else {
                    safeSpeak("목적지 부근입니다. 안내를 종료합니다.");
                    onEndNavigation();
                  }

                  // 현재 단계 완료 처리
                  lastGuideIndex.current = nextIndex;
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
        <div className="absolute inset-0 z-0"><VisionCamera /></div>

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
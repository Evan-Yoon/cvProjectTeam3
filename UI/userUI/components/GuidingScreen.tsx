import React, { useState, useEffect, useRef } from 'react';
import VisionCamera from './VisionCamera'; // 카메라 화면
import { speak, startListening, stopListening } from '../src/utils/audio'; // 음성(TTS/STT)
import DebugMap from './DebugMap'; // 지도 컴포넌트
import { Destination, LatLng, NavigationStep } from '../types';
import { useCompass } from '../src/hooks/useCompass';
import { useTtsQueue } from '../src/hooks/useTtsQueue';

// GuidingScreen은 "길 안내 중" 화면입니다.
// 상단에는 현재 위치/경로 지도를 그리고, 하단에는 카메라 기반 장애물 감지를 띄웁니다.
// GPS, 나침반, TTS, STT가 함께 움직이므로 state와 ref의 역할 구분이 특히 중요합니다.

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
  destination: Destination; // 목적지 정보
  routeData: NavigationStep[]; // 백엔드에서 받은 경로 데이터 (안내 멘트용)
  routePath: { latitude: number; longitude: number }[]; // 지도에 그릴 경로 좌표 (선 그리기용)
  myLocation: LatLng; // 부모로부터 전달받는 실시간 내 위치
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation, destination, routeData, routePath, myLocation }) => {

  // ----------------------------------------------------------------
  // 2. 상태(State) 관리 - 화면 렌더링에 영향을 줌
  // ----------------------------------------------------------------
  const [taps, setTaps] = useState(0); // 화면 터치 횟수 (3번 터치 종료용)
  const [debugMsg, setDebugMsg] = useState(""); // 개발용 디버그 텍스트
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태

  // 지도에 표시할 내 위치와 방향
  const [visualPos, setVisualPos] = useState<{ lat: number, lng: number } | null>(null);

  // ----------------------------------------------------------------
  // 3. 내부 변수 (Ref) - 값이 바뀌어도 화면이 깜빡이지 않음 (고성능 처리용)
  // ----------------------------------------------------------------
  const isMounted = useRef(true); // 컴포넌트가 살아있는지 체크
  const lastGuideIndex = useRef<number>(-1); // 마지막으로 안내한 경로 번호

  const prevPosition = useRef<{ lat: number; lng: number } | null>(null); // 직전 위치 (이동거리 계산용)

  // 센서 퓨전(Sensor Fusion) 보정용
  const targetGpsHeading = useRef<number | null>(null); // 명확한 GPS 이동 궤적 방향
  const gpsActiveTime = useRef<number>(0); // GPS 궤적이 유효하게 측정된 마지막 시간

  // 경로 이탈 감지용 (Off-Route Detection)
  const minDistanceToNext = useRef<number>(Infinity); // 다음 지점까지 좁혔던 최단 거리
  const lastWarningTime = useRef<number>(0); // 마지막으로 경로 이탈 경고를 준 시간 (쿨타임 방지용)

  // ----------------------------------------------------------------
  // 3-1. 커스텀 훅 연동
  // ----------------------------------------------------------------
  const { safeSpeak, isSpeaking } = useTtsQueue();
  const { visualHeading, isOriented, compassHeading } = useCompass({
    targetGpsHeading,
    gpsActiveTime,
    compassOffset: COMPASS_OFFSET,
  });

  // ----------------------------------------------------------------
  // 4. 유틸리티 함수들 (거리 계산, 각도 계산)
  // ----------------------------------------------------------------


  // 두 좌표 사이의 거리 계산 (Haversine 공식 - 지구 곡면 반영)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    // 위도/경도는 평면 좌표가 아니라 각도라서 라디안으로 변환한 뒤 계산합니다.
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
    // 반환값은 0~360도입니다. 0=북쪽, 90=동쪽, 180=남쪽, 270=서쪽입니다.
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
      // 화면 전체를 1초 안에 3번 누르면 안내를 종료하는 간단한 접근성 제스처입니다.
      safeSpeak("안내를 종료합니다.");
      onEndNavigation();
    }
    // 1초 안에 3번 안 치면 초기화
    const timer = setTimeout(() => { if (taps > 0) setTaps(0); }, 1000);
    return () => clearTimeout(timer);
  }, [taps]);


  // ----------------------------------------------------------------
  // 7. ★ 핵심: 네비게이션 로직 (GPS + 경로 안내)
  // ----------------------------------------------------------------
  // 7. 음성 인식 (STT) - "종료"라고 말하면 꺼지는 기능 및 시작 안내
  useEffect(() => {
    isMounted.current = true;

    // 안내 시작 멘트 (2초 뒤 실행)
    if (routeData && routeData.length > 0) {
      setTimeout(() => {
        // routeData[0]은 백엔드가 내려준 첫 안내 지점입니다.
        safeSpeak(`안내를 시작합니다. ${routeData[0].instruction}`);
      }, 2000);
    }

    const listenLoop = async () => {
      // 안내 시작 직후에는 TTS와 STT가 충돌할 수 있으므로 4초 뒤 종료 명령 감지를 시작합니다.
      await new Promise(r => setTimeout(r, 4000));
      if (!isMounted.current) return;

      await startListening((text) => {
        // 안내 중 STT는 목적지 검색이 아니라 종료 키워드만 감지합니다.
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
      stopListening();
    };
  }, [routeData, onEndNavigation]); // routeData나 종료 함수가 바뀌면 재실행

  // 8. ★ 핵심: GPS 위치 변경 반응형 처리 (거리 계산 및 경로 안내)
  useEffect(() => {
    if (!myLocation) return;

    const curLat = myLocation.lat;
    const curLng = myLocation.lng;

    // 지도에 내 위치(점) 업데이트
    setVisualPos({ lat: curLat, lng: curLng });

    // 이동 거리 계산 (1.5m 이상 움직였는지 체크)
    if (prevPosition.current) {
      const movedDist = getDistance(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);

      if (movedDist >= 1.5) {
        // 실제 이동 궤적(GPS Course) 방위각 계산
        const gpsHeading = getBearing(prevPosition.current.lat, prevPosition.current.lng, curLat, curLng);

        // 센서 퓨전을 위해 GPS 이동 방향과 현재 시간을 저장합니다.
        targetGpsHeading.current = gpsHeading;
        gpsActiveTime.current = Date.now();

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
        // 사용자가 체크포인트를 건너뛰었을 가능성을 고려하여 반경 15m 이내 가장 먼 체크포인트 탐색
        let reachedIndex = -1;
        for (let i = routeData.length - 1; i >= nextIndex; i--) {
          const dist = getDistance(curLat, curLng, routeData[i].latitude, routeData[i].longitude);
          if (dist < 15) {
            reachedIndex = i;
            break;
          }
        }

        // 목표 지점 중 하나에 진입 시
        if (reachedIndex !== -1) {
          const nextNextIndex = reachedIndex + 1;

          if (nextNextIndex < routeData.length) {
            const nextInstruction = routeData[nextNextIndex].instruction;
            safeSpeak(`이어서, ${nextInstruction}`);
          } else {
            safeSpeak("목적지 부근입니다. 안내를 종료합니다.");
            onEndNavigation();
          }

          lastGuideIndex.current = reachedIndex;
          minDistanceToNext.current = Infinity;
          lastWarningTime.current = 0;
        }

        // --------- 경로 이탈(역주행 등) 감지 로직 ---------
        const targetLat = routeData[nextIndex].latitude;
        const targetLng = routeData[nextIndex].longitude;
        const distToCurrentTarget = getDistance(curLat, curLng, targetLat, targetLng);

        // 역대 최단 기록보다 현재 거리가 10m 이상 멀어졌다면 경로 이탈로 간주
        if (distToCurrentTarget > minDistanceToNext.current + 10) {
          const now = Date.now();
          // 15초의 쿨타임을 두고 안내 (안내 스팸 방지)
          if (now - lastWarningTime.current > 15000) {
            const bearingToTarget = getBearing(curLat, curLng, targetLat, targetLng);
            const userHeading = compassHeading.current !== null ? compassHeading.current : 0;

            let diffAngle = bearingToTarget - userHeading;

            // 360도 체계 안에서 몇 시 방향인지 계산 (30도를 1시간 단위로 취급)
            let clockFace = Math.round(((diffAngle % 360) + 360) % 360 / 30);
            if (clockFace === 0) clockFace = 12;

            safeSpeak(`경로를 벗어났습니다. ${clockFace}시 방향으로 돌아주세요.`);
            lastWarningTime.current = now;
            minDistanceToNext.current = distToCurrentTarget;
          }
        } else {
          // 거리가 좁혀지고 있다면 최단 거리 기록 갱신
          if (distToCurrentTarget < minDistanceToNext.current) {
            minDistanceToNext.current = distToCurrentTarget;
          }
        }
      }

      // 화면 하단 디버그 메시지 업데이트
      const distToNext = (nextIndex < routeData.length)
        ? getDistance(curLat, curLng, routeData[nextIndex].latitude, routeData[nextIndex].longitude).toFixed(1)
        : "0";

      setDebugMsg(`지점: ${lastGuideIndex.current + 1}/${routeData.length} | 다음: ${distToNext}m | GPS: ${targetGpsHeading.current?.toFixed(0) || '대기'}`);
    } else {
      setDebugMsg(`경로 완료 | GPS: ${targetGpsHeading.current?.toFixed(0) || '대기'}`);
    }
  }, [myLocation, routeData, onEndNavigation]); // routeData가 바뀌면 다시 실행

  return (
    // 화면 전체 클릭은 taps를 증가시켜 3회 터치 종료 제스처를 구현합니다.
    <div className="h-full w-full bg-black flex flex-col relative" onClick={() => setTaps(t => t + 1)}>

      {/* 1. 상단: 지도 영역 (50%) */}
      <div className="h-1/2 w-full relative z-20 border-b-2 border-white bg-gray-900">
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
      <div className="h-1/2 w-full relative">
        {/* 카메라 화면 (배경) */}
        {/* VisionCamera가 장애물을 찾으면 onSpeak로 safeSpeak를 호출해 TTS 큐에 장애물 경고를 넣습니다. */}
        <div className="absolute inset-0 z-0"><VisionCamera onSpeak={safeSpeak} /></div>

        {/* 반투명 검은 배경 위 텍스트 */}
        <div className="absolute inset-0 z-10 bg-black/50 flex flex-col items-center justify-center text-white text-center p-4">
          <h1 className="text-4xl font-black text-primary mb-4">
            {isOriented ? "안내 중" : "방향 탐색 중"}
          </h1>

          <p className="text-2xl font-bold leading-relaxed">
            {/* 아직 첫 지점 도착 전이면 첫 안내 문장을, 이후에는 마지막 도달 지점 안내 문장을 표시합니다. */}
            {lastGuideIndex.current === -1
              ? (routeData[0]?.instruction || "잠시만 기다려주세요")
              : (routeData[lastGuideIndex.current]?.instruction)}
          </p>

          <p className="text-xs mt-6 opacity-60 bg-black/30 px-2 py-1 rounded">
            {/* debugMsg는 실제 서비스 문구라기보다 GPS/경로 상태를 현장에서 확인하기 위한 개발용 표시입니다. */}
            {debugMsg}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuidingScreen;

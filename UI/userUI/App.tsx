import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation'; // GPS용
import { AppScreen, GeoLocation, Destination } from './types';
import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';
import { searchLocation } from './src/api/tmap'; // 장소 이름 -> 좌표 검색
import { requestNavigation, NavigationStep } from './src/api/backend'; // ★ 백엔드 요청
import { speak } from './src/utils/audio';

// Geolocation API에 넘기는 공통 옵션입니다.
// enableHighAccuracy는 GPS 정확도를 높이는 대신 배터리 사용량이 늘 수 있습니다.
// timeout은 한 번의 위치 요청이 너무 오래 걸릴 때 포기하는 시간, maximumAge는 캐시된 위치를 얼마나 허용할지입니다.
const LOCATION_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 10000,
};

const App: React.FC = () => {
  // currentScreen이 이 앱의 "상태 머신" 역할을 합니다.
  // 값이 바뀌면 renderScreen()이 다른 화면 컴포넌트를 반환합니다.
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);

  // 상태 관리
  const [myLocation, setMyLocation] = useState<GeoLocation | null>(null); // 내 위치
  const [destination, setDestination] = useState<Destination | null>(null); // 목적지 좌표
  const [routeData, setRouteData] = useState<NavigationStep[]>([]); // ★ 백엔드에서 받은 경로 (안내용)
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[]>([]); // ★ [추가] 지도 그리기용 경로 좌표

  // 콜백의 불필요한 재생성을 방지하기 위한 Ref 관리
  // useState 값은 화면 렌더링에 쓰이고, useRef 값은 최신 값을 비동기 콜백 안에서 즉시 읽기 위해 씁니다.
  // 예: GPS 콜백이나 음성인식 콜백은 오래 뒤에 실행될 수 있어서, 클로저가 낡은 state를 볼 수 있습니다.
  const myLocationRef = useRef<GeoLocation | null>(null);
  const destinationRef = useRef<Destination | null>(null);

  // 1. 앱 켜자마자 내 GPS 위치 가져오기
  useEffect(() => {
    // watchId는 Geolocation.watchPosition이 반환하는 구독 ID입니다.
    // 컴포넌트가 사라질 때 clearWatch에 넘겨야 배터리/센서 사용이 멈춥니다.
    let watchId: string | null = null;

    const startWatching = async () => {
      try {
        // ★ 권한 요청 추가
        // Capacitor는 iOS/Android 권한 상태를 checkPermissions/requestPermissions로 확인합니다.
        // 브라우저 권한 팝업과 네이티브 권한 팝업을 통합해서 다루기 위한 코드입니다.
        const checkPermission = await Geolocation.checkPermissions();
        if (checkPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            await speak("위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.");
            return;
          }
        }

        watchId = await Geolocation.watchPosition(
          LOCATION_WATCH_OPTIONS,
          (pos, err) => {
            // watchPosition은 성공 위치(pos)와 에러(err)를 같은 콜백으로 넘깁니다.
            // GPS가 일시적으로 약해질 수 있으므로 에러가 나도 앱 전체를 멈추지는 않습니다.
            if (err) {
              console.warn("GPS Watch Retry:", err);
              return;
            }
            if (pos) {
              const newLoc = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              };
              // state는 UI 갱신용, ref는 콜백 내부 최신값 참조용으로 동시에 갱신합니다.
              setMyLocation(newLoc);
              myLocationRef.current = newLoc;
              console.log("📍 내 위치 업데이트:", pos.coords.latitude, pos.coords.longitude);
            }
          }
        );
      } catch (error) {
        console.error("GPS 초기화 에러:", error);
        speak("위치 정보를 가져올 수 없습니다. GPS를 켜주세요.");
      }
    };

    startWatching();

    return () => {
      // useEffect cleanup: 이 컴포넌트가 언마운트되거나 effect가 다시 실행될 때 GPS 구독을 해제합니다.
      if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  // --- 화면 전환 핸들러 ---

  const handleStart = useCallback(() => {
    // 대기 화면에서 시작하면 음성 인식 화면으로 넘어갑니다.
    setCurrentScreen(AppScreen.LISTENING);
  }, []);

  // 2. 음성 인식 후 처리 (바로 TMAP 검색)
  const handleSpeechDetected = useCallback(async (transcript: string) => {
    if (!transcript) return;

    const currentLoc = myLocationRef.current;

    // GPS가 아직 없으면 다시 시도
    if (!currentLoc) {
      await speak("현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      // 한번 더 강제 시도
      try {
        // watchPosition이 아직 값을 못 준 경우, getCurrentPosition으로 단발성 위치 요청을 한 번 더 시도합니다.
        const coordinates = await Geolocation.getCurrentPosition(LOCATION_WATCH_OPTIONS);
        const newLoc = {
          lat: coordinates.coords.latitude,
          lng: coordinates.coords.longitude
        };
        setMyLocation(newLoc);
        myLocationRef.current = newLoc;
      } catch (e) {
        console.error("GPS Retry Fail", e);
      }
      setCurrentScreen(AppScreen.IDLE);
      return;
    }

    // 사용자가 "강남역으로 안내해줘"처럼 말하면 장소 검색에는 "강남역"만 필요합니다.
    // 정규식으로 자주 붙는 명령어 표현을 제거하고 검색 키워드만 남깁니다.
    const keyword = transcript.replace(/으로 안내해줘|로 안내해줘| 안내해줘| 안내/g, "").trim();
    console.log(`🎤 인식된 검색어: ${keyword}`);

    try {
      // (1) 바로 TMAP 검색
      await speak("장소를 검색 중입니다.");
      const location = await searchLocation(keyword, currentLoc.lat, currentLoc.lng);

      if (location) {
        // 검색 성공 -> 확인 화면으로 이동
        // searchLocation은 TMAP 응답을 앱 내부 Destination 타입으로 쓰기 쉬운 형태로 바꿔줍니다.
        const nextDest = {
          name: location.name,
          lat: location.lat,
          lng: location.lng
        };
        setDestination(nextDest);
        destinationRef.current = nextDest;
        setCurrentScreen(AppScreen.CONFIRMATION);
      } else {
        // 검색 실패
        // 실패도 RetryScreen에서 보여줄 수 있도록 특수 목적지 이름(ERROR_*)으로 저장합니다.
        await speak("장소를 찾을 수 없습니다. 다시 말씀해주세요.");
        const errDest = { name: 'ERROR_NOT_FOUND', lat: 0, lng: 0 };
        setDestination(errDest);
        destinationRef.current = errDest;
        setCurrentScreen(AppScreen.RETRY);
      }
    } catch (error) {
      console.error("검색 중 에러:", error);
      await speak("검색 중 오류가 발생했습니다.");
      const errDest = { name: 'ERROR_SEARCH', lat: 0, lng: 0 };
      setDestination(errDest);
      destinationRef.current = errDest;
      setCurrentScreen(AppScreen.RETRY);
    }
  }, []);

  // 3. 목적지 확인 후 -> 백엔드 경로 탐색만 수행
  const handleConfirmDestination = useCallback(async () => {
    // ref에서 읽는 이유: 사용자가 확인 화면에서 응답하는 순간의 최신 목적지/위치를 보장하기 위해서입니다.
    const dest = destinationRef.current;
    const loc = myLocationRef.current;
    if (!dest || !loc) return;

    try {
      await speak(`${dest.name}으로 안내합니다.`);

      // (2) 백엔드 경로 요청
      // backend.ts가 { steps, path } 형태로 리턴하도록 수정되어 있어야 함
      console.log("App.tsx: Requesting navigation with:", {
        start_lat: loc.lat,
        start_lon: loc.lng,
        end_lat: dest.lat,
        end_lon: dest.lng
      });

      const { steps, path } = await requestNavigation({
        start_lat: loc.lat,
        start_lon: loc.lng,
        end_lat: dest.lat,
        end_lon: dest.lng
      });

      console.log("App.tsx: path from backend:", path);
      console.log("App.tsx: steps from backend:", steps);

      // steps는 음성 안내 문장과 체크포인트, path는 지도 선입니다.
      // 둘을 분리해두면 지도 시각화와 안내 멘트가 서로 다른 데이터 모양이어도 대응할 수 있습니다.
      setRouteData(steps);
      setRoutePath(path);
      setCurrentScreen(AppScreen.GUIDING);

    } catch (error: any) {
      console.error("탐색 에러:", error);

      // ★ [수정됨] 환경변수에서 현재 백엔드 URL 가져오기
      const currentBackendUrl = import.meta.env.VITE_BACKEND_URL || "설정된 주소 없음";

      // 모바일 디버깅에서는 콘솔 접근이 어렵기 때문에 alert로 요청 URL과 에러 정보를 직접 보여줍니다.
      const errDetail = {
        message: error.message || 'No message',
        code: error.code || 'No code',
        status: error.status || 'No status',
        data: error.data || 'No data',
      };

      // 디버깅용 알림창 (현재 URL 표시)
      alert(`[Debug]\nURL: ${currentBackendUrl}\nError: ${JSON.stringify(errDetail, null, 2)}`);

      await speak("경로를 안내할 수 없습니다. 잠시 후 다시 시도해주세요.");

      const errDest = { name: `ERROR_NETWORK: ${error.message || 'Unknown'}`, lat: 0, lng: 0 };
      setDestination(errDest);
      destinationRef.current = errDest;
      setCurrentScreen(AppScreen.RETRY);
    }
  }, []);


  const handleDenyDestination = useCallback(() => {
    // 목적지가 틀렸으면 다시 말하기 화면으로 보냅니다.
    setCurrentScreen(AppScreen.RETRY);
  }, []);

  const handleCancel = useCallback(() => {
    // 취소는 앱을 완전히 초기 대기 상태로 되돌립니다.
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    destinationRef.current = null;
    setRouteData([]);
  }, []);

  const handleEndNavigation = useCallback(() => {
    // 안내 종료도 목적지/경로 데이터를 비워 다음 안내가 이전 데이터를 물고 가지 않게 합니다.
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    destinationRef.current = null;
    setRouteData([]);
  }, []);

  const renderScreen = () => {
    // 화면 분기는 AppScreen enum을 기준으로 한 곳에서 관리합니다.
    // 각 화면은 필요한 콜백만 props로 받고, 실제 상태 변경은 대부분 App.tsx가 담당합니다.
    switch (currentScreen) {
      case AppScreen.IDLE:
        return <IdleScreen onStart={handleStart} isLocationReady={!!myLocation} />;
      case AppScreen.LISTENING:
        return <ListeningScreen onCancel={handleCancel} onSpeechDetected={handleSpeechDetected} />;
      case AppScreen.RETRY:
        return (
          <RetryScreen
            onCancel={handleCancel}
            onSpeechDetected={handleSpeechDetected}
            message={
              destination?.name?.startsWith('ERROR')
                // ERROR_* 문자열을 사용자가 볼 수 있는 간단한 메시지로 바꿔 RetryScreen에 넘깁니다.
                ? `${destination.name.replace('ERROR_', '').replace('ERROR', '오류')}`
                : undefined
            }
            // 오류 상태에서는 자동 STT 재시작을 막고, 사용자가 다시 누르거나 흐름을 이해할 시간을 줍니다.
            autoStart={!destination?.name?.startsWith('ERROR')}
          />
        );
      case AppScreen.CONFIRMATION:
        return (
          <ConfirmationScreen
            destination={destination ? destination.name : ''}
            onConfirm={handleConfirmDestination}
            onDeny={handleDenyDestination}
          />
        );
      case AppScreen.GUIDING:
        return destination && myLocation ? (
          <GuidingScreen
            destination={destination}
            routeData={routeData} // 안내 멘트용
            routePath={routePath} // 지도 그리기용
            onEndNavigation={handleEndNavigation}
          />
        ) : null;
      default:
        // 예상하지 못한 화면 값이 들어와도 앱이 빈 화면이 되지 않도록 대기 화면으로 돌립니다.
        return <IdleScreen onStart={handleStart} isLocationReady={!!myLocation} />;
    }
  };

  return (
    // 최상위 레이아웃: 모바일 앱처럼 화면 전체를 차지하고, 내부 스크롤/넘침을 막습니다.
    <div className="w-full h-screen bg-black text-white overflow-hidden font-display relative">
      {renderScreen()}
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation'; // GPS용
import { AppScreen } from './types';
import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';
import { searchLocation } from './src/api/tmap'; // 장소 이름 -> 좌표 검색
import { requestNavigation, NavigationStep } from './src/api/backend'; // ★ 백엔드 요청
import { speak } from './src/utils/audio';
import { getJosa } from './src/utils/josa';

// 내 위치 타입
interface GeoLocation {
  lat: number;
  lng: number;
}

// 목적지 타입
interface Destination {
  name: string;
  lat: number;
  lng: number;
}

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);

  // 상태 관리
  const [myLocation, setMyLocation] = useState<GeoLocation | null>(null); // 내 위치
  const [destination, setDestination] = useState<Destination | null>(null); // 목적지 좌표
  const [routeData, setRouteData] = useState<NavigationStep[]>([]); // ★ 백엔드에서 받은 경로 (안내용)
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[]>([]); // ★ [추가] 지도 그리기용 경로 좌표

  // 1. 앱 켜자마자 내 GPS 위치 가져오기
  useEffect(() => {
    let watchId: string | null = null;

    const startWatching = async () => {
      try {
        // ★ 권한 요청 추가
        const checkPermission = await Geolocation.checkPermissions();
        if (checkPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            await speak("위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.");
            return;
          }
        }

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          (pos, err) => {
            if (err) {
              console.error("GPS Watch Error:", err);
              return;
            }
            if (pos) {
              setMyLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              });
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
      if (watchId) Geolocation.clearWatch({ id: watchId });
    };
  }, []);

  // --- 화면 전환 핸들러 ---

  const handleStart = () => {
    setCurrentScreen(AppScreen.LISTENING);
  };

  // 2. 음성 인식 후 처리 (바로 TMAP 검색)
  const handleSpeechDetected = async (transcript: string) => {
    if (!transcript) return;

    // GPS가 아직 없으면 다시 시도
    if (!myLocation) {
      await speak("현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      // 한번 더 강제 시도
      try {
        const coordinates = await Geolocation.getCurrentPosition();
        setMyLocation({
          lat: coordinates.coords.latitude,
          lng: coordinates.coords.longitude
        });
      } catch (e) {
        console.error("GPS Retry Fail", e);
      }
      setCurrentScreen(AppScreen.IDLE);
      return;
    }

    const keyword = transcript.replace(/으로 안내해줘|로 안내해줘| 안내해줘| 안내/g, "").trim();
    console.log(`🎤 인식된 검색어: ${keyword}`);

    try {
      // (1) 바로 TMAP 검색
      await speak("장소를 검색 중입니다.");
      const location = await searchLocation(keyword, myLocation.lat, myLocation.lng);

      if (location) {
        // 검색 성공 -> 확인 화면으로 이동
        setDestination({
          name: location.name,
          lat: location.lat,
          lng: location.lng
        });
        setCurrentScreen(AppScreen.CONFIRMATION);
      } else {
        // 검색 실패
        await speak("장소를 찾을 수 없습니다. 다시 말씀해주세요.");
        setDestination({ name: 'ERROR_NOT_FOUND', lat: 0, lng: 0 });
        setCurrentScreen(AppScreen.RETRY);
      }
    } catch (error) {
      console.error("검색 중 에러:", error);
      await speak("검색 중 오류가 발생했습니다.");
      setDestination({ name: 'ERROR_SEARCH', lat: 0, lng: 0 });
      setCurrentScreen(AppScreen.RETRY);
    }
  };

  // 3. 목적지 확인 후 -> 백엔드 경로 탐색만 수행
  const handleConfirmDestination = async () => {
    if (!destination || !myLocation) return;

    try {
      await speak(`${destination.name}으로 안내합니다.`);

      // (2) 백엔드 경로 요청
      // backend.ts가 { steps, path } 형태로 리턴하도록 수정되어 있어야 함
      console.log("App.tsx: Requesting navigation with:", {
        start_lat: myLocation.lat,
        start_lon: myLocation.lng,
        end_lat: destination.lat,
        end_lon: destination.lng
      });

      const { steps, path } = await requestNavigation({
        start_lat: myLocation.lat,
        start_lon: myLocation.lng,
        end_lat: destination.lat,
        end_lon: destination.lng
      });

      console.log("App.tsx: path from backend:", path);
      console.log("App.tsx: steps from backend:", steps);

      setRouteData(steps);
      setRoutePath(path);
      setCurrentScreen(AppScreen.GUIDING);

    } catch (error: any) {
      console.error("탐색 에러:", error);

      // ★ [수정됨] 환경변수에서 현재 백엔드 URL 가져오기
      const currentBackendUrl = import.meta.env.VITE_BACKEND_URL || "설정된 주소 없음";

      const errDetail = {
        message: error.message || 'No message',
        code: error.code || 'No code',
        status: error.status || 'No status',
        data: error.data || 'No data',
      };

      // 디버깅용 알림창 (현재 URL 표시)
      alert(`[Debug]\nURL: ${currentBackendUrl}\nError: ${JSON.stringify(errDetail, null, 2)}`);

      await speak("경로를 안내할 수 없습니다. 잠시 후 다시 시도해주세요.");

      setDestination({ name: `ERROR_NETWORK: ${error.message || 'Unknown'}`, lat: 0, lng: 0 });
      setCurrentScreen(AppScreen.RETRY);
    }
  };


  const handleDenyDestination = () => {
    setCurrentScreen(AppScreen.RETRY);
  };

  const handleCancel = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    setRouteData([]);
  };

  const handleEndNavigation = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    setRouteData([]);
  };

  const renderScreen = () => {
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
                ? `${destination.name.replace('ERROR_', '').replace('ERROR', '오류')}`
                : undefined
            }
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
        return <IdleScreen onStart={handleStart} isLocationReady={!!myLocation} />;
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden font-display relative">
      {renderScreen()}
    </div>
  );
};

export default App;
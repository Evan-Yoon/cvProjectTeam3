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
  const [routeData, setRouteData] = useState<NavigationStep[]>([]); // ★ 백엔드에서 받은 경로

  // 1. 앱 켜자마자 내 GPS 위치 가져오기 (watchPosition으로 변경하여 지속 업데이트 및 초기 확보 확률 증대)
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
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, // timeout 증가
          (pos, err) => {
            if (err) {
              console.error("GPS Watch Error:", err);
              // 에러가 나도 계속 시도하거나, 사용자에게 알림 (여기선 로그만)
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

  // 2. 음성 인식 후 처리 (검색 안 함 -> 확인 화면으로 이동)
  // 2. 음성 인식 후 처리 (바로 TMAP 검색)
  const handleSpeechDetected = async (transcript: string) => {
    if (!transcript) return;

    // GPS가 아직 없으면 다시 시도
    if (!myLocation) {
      await speak("현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      const coordinates = await Geolocation.getCurrentPosition();
      setMyLocation({
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      });
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
        // 검색 성공 -> 확인 화면으로 이동 (검색된 장소명 표시)
        setDestination({
          name: location.name,
          lat: location.lat,
          lng: location.lng
        });
        setCurrentScreen(AppScreen.CONFIRMATION);
      } else {
        // 검색 실패
        await speak("장소를 찾을 수 없습니다. 다시 말씀해주세요.");
        setDestination({ name: 'ERROR_NOT_FOUND', lat: 0, lng: 0 }); // 에러 상태 표시
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
      await speak(`${getJosa(destination.name, '으로/로')} 안내합니다.`);

      // (2) 백엔드 경로 요청
      const routes = await requestNavigation({
        start_lat: myLocation.lat,
        start_lon: myLocation.lng,
        end_lat: destination.lat,
        end_lon: destination.lng
      });

      setRouteData(routes);
      setCurrentScreen(AppScreen.GUIDING);

    } catch (error: any) {
      console.error("탐색 에러:", error);

      // 구체적인 에러 메시지 생성
      let errorMsg = "네트워크 오류가 발생했습니다.";
      if (error.message) errorMsg += ` (${error.message})`;

      // ★ 디버깅용 알림 추가
      alert(`[Debug]\nURL: ${import.meta.env.VITE_BACKEND_URL}\nError: ${JSON.stringify(error)}`);

      await speak("경로를 안내할 수 없습니다. 잠시 후 다시 시도해주세요.");

      // ERROR_NETWORK 접두사를 붙여서 RetryScreen에서 구분 가능하게 할 수도 있음, 
      // 혹은 그냥 destination.name을 ERROR_NETWORK로 설정
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
            // 에러 상태가 있으면 그 메시지를 보여주고, 아니면 기본값. 
            // 에러일 때는 자동 재시작 끄기 (사용자가 확인 후 다시 시도하도록)
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
        // ★ GuidingScreen에 백엔드에서 받은 routeData를 넘겨줍니다.
        return destination && myLocation ? (
          <GuidingScreen
            destination={destination}
            routeData={routeData} // 경로 데이터 전달
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
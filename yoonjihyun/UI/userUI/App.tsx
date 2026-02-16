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

  // 1. 앱 켜자마자 내 GPS 위치 가져오기
  useEffect(() => {
    const getMyPos = async () => {
      try {
        const coordinates = await Geolocation.getCurrentPosition();
        setMyLocation({
          lat: coordinates.coords.latitude,
          lng: coordinates.coords.longitude
        });
        console.log("📍 내 위치 확보 완료:", coordinates.coords.latitude, coordinates.coords.longitude);
      } catch (error) {
        console.error("GPS 에러:", error);
        speak("위치 정보를 가져올 수 없습니다. GPS를 켜주세요.");
      }
    };
    getMyPos();
  }, []);

  // --- 화면 전환 핸들러 ---

  const handleStart = () => {
    setCurrentScreen(AppScreen.LISTENING);
  };

  // 2. 음성 인식 후 처리 (검색 안 함 -> 확인 화면으로 이동)
  const handleSpeechDetected = async (transcript: string) => {
    if (!transcript) return;

    // GPS가 아직 없으면 다시 시도
    if (!myLocation) {
      await speak("현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      // 다시 GPS 시도
      const coordinates = await Geolocation.getCurrentPosition();
      setMyLocation({
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      });
      setCurrentScreen(AppScreen.IDLE);
      return;
    }

    const keyword = transcript.replace(/으로 안내해줘|로 안내해줘| 안내해줘| 안내/g, "").trim();
    console.log(`🎤 인식된 목적지: ${keyword}`);

    // (수정) 검색하지 않고 바로 확인 화면으로 이동
    // 좌표는 아직 모르므로 0,0 또는 null 처리
    setDestination({
      name: keyword,
      lat: 0,
      lng: 0
    });
    setCurrentScreen(AppScreen.CONFIRMATION);
  };

  // 3. 목적지 확인 후 -> 실제 검색 및 경로 탐색
  const handleConfirmDestination = async () => {
    if (!destination || !myLocation) return;

    try {
      await speak(`${destination.name} 경로를 탐색합니다.`);

      // (1) TMAP으로 장소 검색 (내 위치 기준 가장 가까운 곳)
      const location = await searchLocation(destination.name, myLocation.lat, myLocation.lng);

      if (location) {
        // 정확한 좌표로 업데이트
        const destInfo = {
          name: location.name, // 검색된 정식 명칭으로 변경 (선택사항)
          lat: location.lat,
          lng: location.lng
        };
        setDestination(destInfo);

        // (2) 백엔드 경로 요청
        const routes = await requestNavigation({
          start_lat: myLocation.lat,
          start_lon: myLocation.lng,
          end_lat: destInfo.lat,
          end_lon: destInfo.lng
        });

        setRouteData(routes);
        setCurrentScreen(AppScreen.GUIDING);
      } else {
        await speak("장소를 찾을 수 없습니다. 다시 말씀해주세요.");
        setCurrentScreen(AppScreen.RETRY);
      }
    } catch (error) {
      console.error("탐색 에러:", error);
      await speak("오류가 발생했습니다. 다시 시도해주세요.");
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
        return <IdleScreen onStart={handleStart} />;
      case AppScreen.LISTENING:
        return <ListeningScreen onCancel={handleCancel} onSpeechDetected={handleSpeechDetected} />;
      case AppScreen.RETRY:
        return <RetryScreen onCancel={handleCancel} onSpeechDetected={handleSpeechDetected} />;
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
        return <IdleScreen onStart={handleStart} />;
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden font-display relative">
      {renderScreen()}
    </div>
  );
};

export default App;
import React, { useState } from 'react';
import { AppScreen } from './types'; // 화면 상태 Enum
import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';
import { searchLocation } from './src/api/tmap'; // ★ [추가] 장소 검색 API import
import { speak } from './src/utils/audio'; // ★ [추가] 검색 실패 시 음성 안내용

interface Destination {
  name: string;
  lat: number;
  lng: number;
}

const App: React.FC = () => {
  // --- 상태 관리 ---
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);
  const [destination, setDestination] = useState<Destination | null>(null);

  // --- 화면 전환 핸들러 ---

  const handleStart = () => {
    setCurrentScreen(AppScreen.LISTENING);
  };

  // ★ [수정] 음성 인식 후 실제 장소 검색
  const handleSpeechDetected = async (transcript: string) => {
    if (!transcript) return;

    // 1. 불필요한 조사 제거 ("광교중앙역으로 안내해줘" -> "광교중앙역")
    const keyword = transcript
      .replace(/으로 안내해줘|로 안내해줘| 안내해줘| 안내/g, "")
      .trim();

    console.log(`🔍 장소 검색 시도: ${keyword}`);

    try {
      // 2. TMAP API로 장소 검색
      const result = await searchLocation(keyword);

      if (result) {
        // 3. 검색 성공 시: 목적지 정보 저장 및 확인 화면으로 이동
        setDestination({
          name: result.name, // API가 돌려준 정확한 장소명 (예: "광교중앙역 신분당선")
          lat: result.lat,
          lng: result.lng
        });
        setCurrentScreen(AppScreen.CONFIRMATION);
      } else {
        // 4. 검색 실패 시: 다시 시도 화면으로 이동
        await speak("장소를 찾지 못했습니다. 다시 말씀해주세요.");
        setCurrentScreen(AppScreen.RETRY);
      }
    } catch (error) {
      console.error("장소 검색 에러:", error);
      await speak("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setCurrentScreen(AppScreen.RETRY);
    }
  };

  const handleConfirmDestination = () => {
    setCurrentScreen(AppScreen.GUIDING);
  };

  const handleDenyDestination = () => {
    setCurrentScreen(AppScreen.RETRY);
  };

  const handleCancel = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
  };

  const handleEndNavigation = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
  };

  // --- 렌더링 로직 ---
  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.IDLE:
        return <IdleScreen onStart={handleStart} />;

      case AppScreen.LISTENING:
        return (
          <ListeningScreen
            onCancel={handleCancel}
            onSpeechDetected={handleSpeechDetected} // async 함수 연결
          />
        );

      case AppScreen.RETRY:
        return (
          <RetryScreen
            onCancel={handleCancel}
            onSpeechDetected={handleSpeechDetected} // Retry에서도 동일하게 검색 로직 사용
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
        // destination이 null일 경우 방어 코드 (! 사용)
        return destination ? (
          <GuidingScreen
            onEndNavigation={handleEndNavigation}
            destination={destination}
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
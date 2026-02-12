import React, { useState } from 'react';
import { AppScreen } from './types'; // 화면 상태를 정의한 Enum (IDLE, LISTENING, etc.)
import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';

const App: React.FC = () => {
  // --- 상태 관리 (State Management) ---

  // 1. 현재 화면 상태 (Default: IDLE - 대기 화면)
  // 이 변수가 바뀌면 앱의 화면이 통째로 바뀝니다.
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);

  // 2. 목적지 데이터
  // 사용자가 말한 목적지(예: "강남역")를 저장해서 다른 화면으로 넘겨줍니다.
  const [destination, setDestination] = useState<string>('');

  // --- 화면 전환 핸들러 (Navigation Logic) ---

  // 대기 화면 -> 듣기 화면 (앱 시작)
  const handleStart = () => {
    setCurrentScreen(AppScreen.LISTENING);
  };

  // 듣기/재시도 화면 -> 확인 화면 (음성 인식 성공 시)
  // transcript: 인식된 텍스트 (데모용 기본값: "강남역")
  const handleSpeechDetected = (transcript: string = "강남역") => {
    setDestination(transcript); // 목적지 저장
    setCurrentScreen(AppScreen.CONFIRMATION); // 확인 화면으로 이동
  };

  // 확인 화면 -> 안내 화면 (사용자가 "예"라고 했을 때)
  const handleConfirmDestination = () => {
    setCurrentScreen(AppScreen.GUIDING);
  };

  // 확인 화면 -> 재시도 화면 (사용자가 "아니오"라고 했을 때)
  const handleDenyDestination = () => {
    // 바로 대기 화면으로 가지 않고, 다시 말할 기회를 줍니다.
    setCurrentScreen(AppScreen.RETRY);
  };

  // 모든 화면 -> 대기 화면 (취소 시)
  const handleCancel = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(''); // 목적지 초기화
  };

  // 안내 화면 -> 대기 화면 (안내 종료 시)
  const handleEndNavigation = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(''); // 목적지 초기화
  };

  // --- 렌더링 로직 (Conditional Rendering) ---
  // currentScreen의 값에 따라 보여줄 컴포넌트를 갈아끼웁니다.
  // 복잡한 라우터(Router) 라이브러리 대신 Switch문을 사용하여 가볍게 구현했습니다.
  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.IDLE:
        return <IdleScreen onStart={handleStart} />;

      case AppScreen.LISTENING:
        return (
          <ListeningScreen
            onCancel={handleCancel}
            onSpeechDetected={(text) => handleSpeechDetected(text)} // text를 받아서 넘겨줌
          />
        );

      case AppScreen.RETRY:
        return (
          <RetryScreen
            onCancel={handleCancel}
            // RetryScreen now passes the actual transcript
            onSpeechDetected={(text) => handleSpeechDetected(text)}
          />
        );

      case AppScreen.CONFIRMATION:
        return (
          <ConfirmationScreen
            destination={destination} // 저장된 목적지를 전달
            onConfirm={handleConfirmDestination}
            onDeny={handleDenyDestination}
          />
        );

      case AppScreen.GUIDING:
        return <GuidingScreen onEndNavigation={handleEndNavigation} destination={destination} />;

      default:
        return <IdleScreen onStart={handleStart} />;
    }
  };

  return (
    // 앱의 최상위 컨테이너
    // w-full h-screen: 화면 전체를 꽉 채움
    // bg-black: 시각장애인용 고대비/배터리 절약을 위한 검은 배경
    // font-display: 전체 폰트 설정
    <div className="w-full h-screen bg-black text-white overflow-hidden font-display relative">

      {/* Global Status Bar Overlay */}
      {/* 필요하다면 여기에 전역 상태바(배터리, 와이파이 등)를 띄울 수 있지만, 
          지금은 각 화면 컴포넌트가 개별적으로 디자인을 가지고 있어 주석 처리됨 */}

      {/* 실제 화면이 렌더링되는 곳 */}
      {renderScreen()}
    </div>
  );
};

export default App;
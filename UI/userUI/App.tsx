import { AppScreen } from './types';

import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';

import { useGeolocation } from '@/src/hooks/useGeolocation';
import { useNavigation } from '@/src/hooks/useNavigation';

const App = () => {
  // GPS 로직 위임
  const { myLocation, myLocationRef } = useGeolocation();

  // 안내 및 상태 머신 로직 위임
  const {
    currentScreen,
    destination,
    routeData,
    routePath,
    handleStart,
    handleSpeechDetected,
    handleConfirmDestination,
    handleDenyDestination,
    handleCancel,
    handleEndNavigation,
  } = useNavigation(myLocationRef);

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

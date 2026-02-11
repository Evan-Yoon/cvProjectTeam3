import React, { useState } from 'react';
import { AppScreen } from './types';
import IdleScreen from './components/IdleScreen';
import ListeningScreen from './components/ListeningScreen';
import RetryScreen from './components/RetryScreen';
import ConfirmationScreen from './components/ConfirmationScreen';
import GuidingScreen from './components/GuidingScreen';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);
  const [destination, setDestination] = useState<string>('');

  const handleStart = () => {
    setCurrentScreen(AppScreen.LISTENING);
  };

  const handleSpeechDetected = (transcript: string = "강남역") => {
    setDestination(transcript);
    setCurrentScreen(AppScreen.CONFIRMATION);
  };

  const handleConfirmDestination = () => {
    setCurrentScreen(AppScreen.GUIDING);
  };

  const handleDenyDestination = () => {
    // If user denies, maybe go to retry or back to listening
    setCurrentScreen(AppScreen.RETRY);
  };

  const handleCancel = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination('');
  };

  const handleEndNavigation = () => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination('');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.IDLE:
        return <IdleScreen onStart={handleStart} />;
      case AppScreen.LISTENING:
        return (
          <ListeningScreen
            onCancel={handleCancel}
            onSpeechDetected={() => handleSpeechDetected("강남역")}
          />
        );
      case AppScreen.RETRY:
        return (
          <RetryScreen
            onCancel={handleCancel}
            onSpeechDetected={() => handleSpeechDetected("홍대입구")} // Demo different destination on retry
          />
        );
      case AppScreen.CONFIRMATION:
        return (
          <ConfirmationScreen
            destination={destination}
            onConfirm={handleConfirmDestination}
            onDeny={handleDenyDestination}
          />
        );
      case AppScreen.GUIDING:
        return <GuidingScreen onEndNavigation={handleEndNavigation} />;
      default:
        return <IdleScreen onStart={handleStart} />;
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden font-display relative">
      {/* Global Status Bar Overlay - Positioned absolutely to persist across screens if needed, 
           but individual screens handle their own layout for better fidelity to the screenshots */}
      {renderScreen()}
    </div>
  );
};

export default App;
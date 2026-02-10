import React, { useState, useEffect, useRef } from 'react';
import { LiveClient } from './services/liveClient';
import { AppState } from './types';
import { Waveform } from './components/Waveform';

const API_KEY = process.env.API_KEY || '';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [destination, setDestination] = useState<string>('');
  const [volume, setVolume] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const clientRef = useRef<LiveClient | null>(null);

  useEffect(() => {
    // Check permissions
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => setHasPermission(true))
        .catch(() => setHasPermission(false));

    return () => {
        if (clientRef.current) {
            clientRef.current.disconnect();
        }
    };
  }, []);

  const handleToolCall = async (name: string, args: any) => {
      console.log(`Handling tool: ${name}`);
      switch (name) {
          case 'proposeDestination':
              setDestination(args.destination);
              setAppState(AppState.CONFIRMING);
              return { status: 'confirming', destination: args.destination };
          case 'startNavigation':
              setAppState(AppState.NAVIGATING);
              return { status: 'navigating' };
          case 'stopNavigation':
              setAppState(AppState.IDLE);
              if (clientRef.current) {
                  // Reconnect or reset session to start fresh? 
                  // For now, we stay connected but state is IDLE visually.
              }
              return { status: 'idle' };
          case 'askAgain':
              setAppState(AppState.RETRY);
              return { status: 'retry' };
          default:
              return { error: 'Unknown tool' };
      }
  };

  const startSession = async () => {
      if (!API_KEY) {
          alert('API Key is missing. Please check your environment.');
          return;
      }
      
      setAppState(AppState.LISTENING);
      
      if (!clientRef.current) {
          clientRef.current = new LiveClient(
              API_KEY,
              handleToolCall,
              (vol) => setVolume(vol)
          );
      }
      
      try {
        await clientRef.current.connect();
      } catch (e) {
        console.error("Connection failed", e);
        setAppState(AppState.ERROR);
      }
  };

  const cancel = () => {
      setAppState(AppState.IDLE);
      setDestination('');
      // Optionally disconnect audio if needed, or just keep session alive and soft-reset
  };

  // --- RENDER HELPERS ---

  const Header = () => (
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 text-gray-400">
          <div className="font-bold tracking-widest text-sm">WALKMATE</div>
          <div className="flex gap-2">
            <span className="material-icons text-sm">signal_cellular_alt</span>
            <span className="material-icons text-sm">wifi</span>
            <span className="material-icons text-sm">battery_full</span>
          </div>
      </div>
  );

  const SettingsButton = () => (
      <button className="absolute top-6 left-6 text-gray-500 hover:text-white">
          <span className="material-icons" style={{ fontSize: '32px' }}>settings</span>
      </button>
  );
  
  const HistoryButton = () => (
    <button className="absolute top-6 right-6 text-gray-500 hover:text-white">
        <span className="material-icons" style={{ fontSize: '32px' }}>history</span>
    </button>
);

  // --- VIEWS ---

  if (appState === AppState.IDLE) {
      return (
          <div className="h-screen w-full relative bg-black bg-pattern flex flex-col items-center justify-center cursor-pointer" onClick={startSession}>
              <SettingsButton />
              <HistoryButton />
              
              <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md px-6">
                  <div className="relative mb-12">
                      <div className="w-48 h-48 rounded-full border-4 border-mate-yellow flex items-center justify-center bg-mate-dark shadow-[0_0_30px_rgba(255,193,5,0.3)]">
                          <span className="material-icons text-mate-yellow" style={{ fontSize: '96px' }}>mic</span>
                      </div>
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-mate-dark border border-gray-700 px-4 py-1 rounded-full flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-bold text-gray-300">대기 중</span>
                      </div>
                  </div>

                  <div className="text-center mb-16">
                      <h1 className="text-5xl font-black mb-2">Walk<span className="text-mate-yellow">Mate</span></h1>
                      <p className="text-gray-400 font-medium">접근성 모드 활성화됨</p>
                  </div>

                  <div className="text-center animate-pulse-slow">
                      <h2 className="text-3xl font-bold text-mate-yellow mb-2">"안내 시작"이라고<br/>말해보세요</h2>
                      <p className="text-gray-500 mt-8 text-lg">또는 화면 아무 곳이나 눌러서 시작</p>
                  </div>
              </div>
          </div>
      );
  }

  if (appState === AppState.LISTENING) {
      return (
          <div className="h-screen w-full relative bg-black flex flex-col items-center justify-center cursor-pointer" onClick={cancel}>
              <Header />
              
              <div className="flex flex-col items-center justify-center flex-1 w-full space-y-12">
                  <div className="text-center space-y-4">
                      <h2 className="text-4xl font-bold text-white">어디로 가고<br/>싶으신가요?</h2>
                      <p className="text-mate-yellow text-xl">듣고 있습니다...</p>
                  </div>

                  <Waveform active={true} volume={volume} />
              </div>

              <div className="absolute bottom-12 w-full text-center">
                  <p className="text-gray-600 text-sm">화면 아무 곳이나 눌러서 취소</p>
              </div>
          </div>
      );
  }

  if (appState === AppState.RETRY) {
    return (
        <div className="h-screen w-full relative bg-black flex flex-col items-center justify-center cursor-pointer" onClick={cancel}>
            <Header />
            
            <div className="flex flex-col items-center justify-center flex-1 w-full space-y-12">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-bold text-mate-yellow">다시<br/>말씀해주세요</h2>
                    <p className="text-xl font-bold text-gray-400">예: "강남역"</p>
                </div>

                <Waveform active={true} volume={volume} />

                <div className="w-20 h-20 rounded-full border border-gray-700 flex items-center justify-center bg-gray-900 mt-8">
                     <span className="material-icons text-mate-yellow text-3xl">mic</span>
                </div>
            </div>

            <div className="absolute bottom-12 w-full px-6">
                <div className="border border-gray-800 bg-gray-900 rounded-xl p-6 text-center">
                    <p className="text-lg text-mate-yellow font-bold mb-1">
                        "아니, <span className="text-white bg-gray-800 px-1 rounded">목적지</span> "라고<br/>말씀하셔도 됩니다
                    </p>
                </div>
                <p className="text-gray-600 text-sm text-center mt-6">화면을 터치하여 취소</p>
            </div>
        </div>
    );
  }

  if (appState === AppState.CONFIRMING) {
      return (
          <div className="h-screen w-full relative bg-black flex flex-col items-center justify-center cursor-pointer" onClick={cancel}>
              <Header />
              
              <div className="relative mb-12">
                  <div className="w-64 h-64 rounded-full border border-gray-800 flex items-center justify-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-ping opacity-20"></div>
                  <div className="w-48 h-48 rounded-full border border-mate-yellow flex items-center justify-center relative bg-black">
                      <span className="material-icons text-mate-yellow text-6xl">mic</span>
                  </div>
              </div>

              <div className="text-center z-10">
                  <h1 className="text-5xl font-bold text-mate-yellow mb-4">{destination}</h1>
                  <h2 className="text-3xl font-bold text-white">맞으신가요?</h2>
              </div>
              
              <div className="absolute bottom-12 w-full text-center px-8">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <p className="text-white text-lg">"응" 또는 "아니"라고 말씀해 주세요</p>
                </div>
              </div>
          </div>
      );
  }

  if (appState === AppState.NAVIGATING) {
      return (
          <div className="h-screen w-full relative bg-black flex flex-col items-center justify-center cursor-pointer" onClick={() => setAppState(AppState.IDLE)}>
              <Header />
              
              <div className="flex-1 flex flex-col items-center justify-center">
                  <h1 className="text-6xl font-black text-mate-yellow mb-4 tracking-tighter">안내 중...</h1>
              </div>

              <div className="absolute bottom-12 w-full text-center space-y-4">
                  <h3 className="text-2xl font-bold text-mate-yellow">"안내 종료"라고<br/>말해보세요</h3>
                  <p className="text-gray-500 text-sm">또는 화면을 3번 탭하면 안내가 종료됩니다</p>
              </div>
          </div>
      );
  }
  
  if (appState === AppState.ERROR) {
      return (
        <div className="h-screen w-full relative bg-black flex flex-col items-center justify-center cursor-pointer" onClick={() => setAppState(AppState.IDLE)}>
            <div className="text-red-500 text-center px-6">
                <span className="material-icons text-6xl mb-4">error_outline</span>
                <h1 className="text-2xl font-bold mb-2">오류가 발생했습니다</h1>
                <p className="text-gray-400">마이크 권한을 확인하거나<br/>잠시 후 다시 시도해주세요.</p>
                <div className="mt-8 text-sm text-gray-600">화면을 눌러 돌아가기</div>
            </div>
        </div>
      );
  }

  return null;
}
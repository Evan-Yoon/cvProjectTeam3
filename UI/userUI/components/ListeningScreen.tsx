import React from 'react';
import { useVoiceDialog } from '@/src/hooks/useVoiceDialog';

// Props 인터페이스 정의
interface ListeningScreenProps {
  // 취소 시 부모(App.tsx)가 IDLE 화면으로 되돌립니다.
  onCancel: () => void;
  // 인식된 텍스트(string)를 부모(App.tsx)에게 전달합니다.
  onSpeechDetected: (text: string) => void;
}

const ListeningScreen: React.FC<ListeningScreenProps> = ({ onCancel, onSpeechDetected }) => {
  const { triggerManualConfirm } = useVoiceDialog({
    promptMessage: "어디로 가고 싶으신가요?",
    onFinalResult: onSpeechDetected,
  });

  return (
    <div className="h-full w-full flex flex-col items-center justify-between pt-24 pb-12 px-6 relative z-10">

      {/* --- 배경 취소 영역 --- */}
      <div
        className="absolute inset-0 z-0"
        onClick={onCancel}
        aria-label="화면 아무 곳이나 눌러서 취소"
      ></div>

      {/* --- 상단 안내 텍스트 --- */}
      <section className="w-full text-center space-y-6 animate-fade-in-up pointer-events-none z-10">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/30">
          <span className="material-icons-round text-primary text-4xl">mic</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.3] tracking-tight break-keep">
          어디로 가고<br />싶으신가요?
        </h1>

        <p className="text-xl text-primary font-bold animate-pulse">
          듣고 있습니다...
        </p>
      </section>

      {/* --- 오디오 파형 비주얼라이저 --- */}
      <section
        className="flex-1 flex items-center justify-center w-full py-12 pointer-events-auto z-20 cursor-pointer"
        // 클릭 시 수동 확정 핸들러 호출
        onClick={triggerManualConfirm}
        title="터치하여 현재 인식된 주소로 확정하기"
      >
        <div className="relative w-full h-48 flex items-center justify-center gap-2 md:gap-4">
          <style>{`
            @keyframes wave {
              0%, 100% { height: 20%; }
              50% { height: 100%; }
            }
          `}</style>
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transform scale-150"></div>

          {/* 파형 애니메이션 */}
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-12 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-20 animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-32 animate-[wave_0.8s_ease-in-out_infinite_0.2s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-48 animate-[wave_1.5s_ease-in-out_infinite_0.15s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-24 animate-[wave_1.1s_ease-in-out_infinite_0.4s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-16 animate-[wave_0.9s_ease-in-out_infinite_0.25s]"></div>
        </div>
      </section>

      {/* --- 하단 안내 문구 --- */}
      <section className="w-full space-y-4 pointer-events-none z-10">
        <div className="h-12 w-full flex items-center justify-center text-zinc-500 text-sm font-medium">
          화면 아무 곳이나 눌러서 취소
        </div>
      </section>
    </div>
  );
};

export default ListeningScreen;

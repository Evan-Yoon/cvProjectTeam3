import React, { useEffect, useRef } from 'react';
import { speak, startListening, stopListening } from './utils/audio'; // ★ utils에서 함수 가져오기

// Props 인터페이스 정의
interface ListeningScreenProps {
  onCancel: () => void;
  // ★ 중요: 인식된 텍스트(string)를 부모(App.tsx)에게 전달해야 하므로 타입을 변경했습니다.
  onSpeechDetected: (text: string) => void;
}

const ListeningScreen: React.FC<ListeningScreenProps> = ({ onCancel, onSpeechDetected }) => {
  // 컴포넌트 마운트 여부 확인 (비동기 처리 시 에러 방지)
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // 1. 화면 진입 시 TTS 안내 멘트 재생
    speak("어디로 가고 싶으신가요?");

    // 2. TTS가 끝날 즈음(약 1.5초 후) 마이크 켜기
    // (바로 켜면 TTS 소리를 마이크가 다시 듣는 현상 방지)
    const timer = setTimeout(async () => {
      if (!isMounted.current) return;

      console.log("🎤 음성 인식 시작 요청...");

      await startListening(
        (transcript) => {
          // [성공 시] 인식된 텍스트를 부모 컴포넌트로 전달
          console.log("✅ 인식 성공:", transcript);
          if (isMounted.current) {
            onSpeechDetected(transcript);
          }
        },
        () => {
          // [실패/에러 시] 
          console.log("❌ 인식 실패 또는 취소됨");
          // 필요하면 여기서 재시도 안내를 하거나, 조용히 있을 수 있습니다.
        }
      );
    }, 1500); // 1.5초 대기

    // 3. 뒷정리 (화면을 나가거나 취소할 때)
    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      stopListening(); // ★ 마이크 끄기
    };
  }, [onSpeechDetected]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-between pt-24 pb-12 px-6 relative z-10">

      {/* --- 배경 취소 영역 --- */}
      <div
        className="absolute inset-0 z-0"
        onClick={() => {
          stopListening(); // 취소 시 명시적으로 마이크 끄기
          onCancel();
        }}
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
        // 클릭 시 강제로 인식 성공 처리 (테스트용 혹은 말하기 힘들 때)
        onClick={() => onSpeechDetected("강남역")}
        title="터치하여 강남역으로 테스트"
      >
        <div className="relative w-full h-48 flex items-center justify-center gap-2 md:gap-4">
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transform scale-150"></div>

          {/* 파형 애니메이션 (그대로 유지) */}
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
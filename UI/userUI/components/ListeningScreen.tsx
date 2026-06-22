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
  const latestText = useRef<string>(""); // 실시간 인식 조각 저장
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);

  // 디바운스 타이머 설정 (침묵 1.3초 감지 시 자동 종료)
  const resetSilenceTimer = (currentText: string) => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);

    silenceTimer.current = setTimeout(() => {
      if (isMounted.current && currentText.trim()) {
        console.log("🤫 침묵 감지 -> 자동 음성인식 확정:", currentText);
        stopListening();
        onSpeechDetected(currentText);
      }
    }, 1300); // 1.3초 동안 침묵할 경우
  };

  useEffect(() => {
    isMounted.current = true;

    const runSTTFlow = async () => {
      if (!isMounted.current) return;

      // 1. TTS 안내 멘트 재생이 끝날 때까지 대기
      await speak("어디로 가고 싶으신가요?");

      // 2. 오디오 세션 전환을 위해 300ms 짧은 대기
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!isMounted.current) return;
      console.log("🎤 음성 인식 시작 요청...");

      await startListening(
        (finalResult) => {
          // [최종 결과 수신 시] 
          const resultText = finalResult || latestText.current;
          console.log("✅ 최종 결과 완료:", resultText);
          if (isMounted.current) {
            onSpeechDetected(resultText);
          }
        },
        () => {
          // [실패/에러 시] 
          console.log("❌ 인식 실패 또는 취소됨");
        },
        (partialText) => {
          // [실시간 중간 인식 시] 누적 데이터 갱신 및 침묵 타이머 리셋
          latestText.current = partialText;
          resetSilenceTimer(partialText);
        }
      );
    };

    runSTTFlow();

    // 3. 네이티브 리소스를 닫는 클린업 함수
    return () => {
      isMounted.current = false;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      stopListening(); // ★ 마이크 끄기
    };
  }, [onSpeechDetected]);

  // 화면 터치 시 수동 확정 처리
  const handleTouchConfirm = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    stopListening();

    // 말한 내용이 존재하면 그것으로 확정
    const confirmedText = latestText.current.trim();
    console.log("👆 화면 터치 -> 수동 텍스트 확정:", confirmedText);

    if (confirmedText) {
      onSpeechDetected(confirmedText);
    } else {
      // 말한 내용이 없는 상태에서 터치한 경우 -> 다시 말해달라는 화면(RETRY)으로 유도
      console.log("⚠️ 말한 내용 없음 -> 재시도(RETRY) 화면 유도");
      onSpeechDetected("ERROR_NOT_FOUND");
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-between pt-24 pb-12 px-6 relative z-10">

      {/* --- 배경 취소 영역 --- */}
      <div
        className="absolute inset-0 z-0"
        onClick={() => {
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
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
        // 클릭 시 수동 확정 핸들러 호출
        onClick={handleTouchConfirm}
        title="터치하여 현재 인식된 주소로 확정하기"
      >
        <div className="relative w-full h-48 flex items-center justify-center gap-2 md:gap-4">
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
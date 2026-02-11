import React, { useEffect } from 'react';

// Props 인터페이스 정의
// onCancel: 취소하고 이전 화면으로 돌아가는 함수
// onSpeechDetected: 음성이 인식되었을 때 다음 단계(확인 화면)로 넘어가는 함수
interface ListeningScreenProps {
  onCancel: () => void;
  onSpeechDetected: () => void;
}

const ListeningScreen: React.FC<ListeningScreenProps> = ({ onCancel, onSpeechDetected }) => {

  // --- 음성 인식 시뮬레이션 (데모용) ---
  // 실제 앱에서는 Web Speech API (window.SpeechRecognition)를 연결해야 합니다.
  // 현재는 데모를 위해 3.5초가 지나면 자동으로 인식이 완료된 것으로 처리합니다.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSpeechDetected(); // 3.5초 후 "강남역" 인식 성공 처리
    }, 3500);

    // 컴포넌트가 사라지면(언마운트) 타이머도 취소 (메모리 누수 방지)
    return () => clearTimeout(timer);
  }, [onSpeechDetected]);

  return (
    // 전체 화면 컨테이너
    // h-full w-full: 전체 꽉 채움
    // z-10: 다른 요소들보다 위에 배치
    <div className="h-full w-full flex flex-col items-center justify-between pt-24 pb-12 px-6 relative z-10">

      {/* --- 배경 취소 영역 (Background Cancel Click Area) --- */}
      {/* 화면의 빈 공간 어디를 눌러도 '취소'가 되도록 만든 투명한 막 */}
      {/* 접근성(UX): 작은 'X' 버튼을 찾기 힘든 시각장애인을 위한 배려 */}
      <div
        className="absolute inset-0 z-0"
        onClick={onCancel}
        aria-label="화면 아무 곳이나 눌러서 취소" // 스크린 리더가 읽어줄 텍스트
      ></div>

      {/* --- 상단 안내 텍스트 --- */}
      {/* pointer-events-none: 글자를 눌러도 클릭이 투과되어 뒤쪽의 '취소' 기능이 작동하게 함 */}
      <section className="w-full text-center space-y-6 animate-fade-in-up pointer-events-none z-10">
        {/* 마이크 아이콘 아이콘 */}
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/30">
          <span className="material-icons-round text-primary text-4xl">mic</span>
        </div>

        {/* 메인 질문 */}
        <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.3] tracking-tight break-keep">
          어디로 가고<br />싶으신가요?
        </h1>

        {/* 상태 메시지 (깜빡임 효과) */}
        <p className="text-xl text-primary font-bold animate-pulse">
          듣고 있습니다...
        </p>
      </section>

      {/* --- 오디오 파형 비주얼라이저 (Audio Visualizer) --- */}
      {/* 소리를 듣고 있다는 것을 시각적으로 표현하는 애니메이션 바 */}
      {/* 클릭 시 즉시 인식 성공 처리 (데모 시연용 기능) */}
      <section
        className="flex-1 flex items-center justify-center w-full py-12 pointer-events-auto z-20 cursor-pointer"
        onClick={onSpeechDetected}
        title="Click to simulate speaking 'Gangnam Station'"
      >
        <div className="relative w-full h-48 flex items-center justify-center gap-2 md:gap-4">
          {/* 배경 글로우 효과 (뿌연 빛) */}
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transform scale-150"></div>

          {/* 파형 바 (Animation Bars) */}
          {/* 각 바(div)마다 높이(h)와 애니메이션 딜레이를 다르게 주어 불규칙한 파형을 만듦 */}
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-12 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-20 animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-32 animate-[wave_0.8s_ease-in-out_infinite_0.2s]"></div>
          {/* 중앙의 가장 긴 바 */}
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
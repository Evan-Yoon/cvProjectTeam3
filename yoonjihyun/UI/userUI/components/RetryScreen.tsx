import React from 'react';

// Props 인터페이스 정의
// onCancel: 취소하고 대기 화면으로 돌아가는 함수
// onSpeechDetected: 다시 말하기를 시작하는 함수 (음성 인식 재시도)
interface RetryScreenProps {
  onCancel: () => void;
  onSpeechDetected: () => void;
}

const RetryScreen: React.FC<RetryScreenProps> = ({ onCancel, onSpeechDetected }) => {
  return (
    // 전체 화면 컨테이너
    <div className="h-full w-full flex flex-col items-center justify-between p-6 relative z-10">

      {/* --- 배경 클릭 영역 (Background Click to Cancel) --- */}
      {/* z-0: 가장 뒤쪽에 배치 */}
      {/* 화면의 빈 공간(배경)을 누르면 '취소(onCancel)'가 실행됨 */}
      <div
        className="absolute inset-0 z-0"
        onClick={onCancel}
        aria-label="Cancel retry"
      ></div>

      {/* --- 상단 헤더 (Header) --- */}
      {/* pointer-events-none: 터치 입력을 무시하고 뒤쪽 배경으로 넘김 */}
      <div className="w-full flex justify-between items-center text-primary/60 pt-2 px-2 z-10 pointer-events-none">
        <span className="text-sm font-semibold tracking-wider">WALKMATE</span>
        <div className="flex gap-1">
          <span className="material-icons-round text-sm">wifi</span>
          <span className="material-icons-round text-sm">battery_full</span>
        </div>
      </div>

      {/* --- 메인 콘텐츠 영역 (Main Content) --- */}
      {/* z-20: 배경(z-0)보다 위에 배치하여 클릭을 가로챔 */}
      <div
        className="flex-1 flex flex-col items-center justify-center w-full space-y-12 z-20 cursor-pointer"
        onClick={(e) => {
          // ★ 중요: 이벤트 전파 방지 (stopPropagation)
          // 이 영역을 클릭했을 때는 부모나 뒤쪽 요소(배경)로 클릭 이벤트가 전달되면 안 됩니다.
          // 만약 이게 없으면, 재시도(onSpeechDetected)와 취소(onCancel)가 동시에 실행될 수 있습니다.
          e.stopPropagation();
          onSpeechDetected(); // 재인식 시작
        }}
      >
        {/* 안내 텍스트 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tight leading-tight drop-shadow-lg">
            다시<br />말씀해주세요
          </h1>
          <p className="text-xl md:text-2xl font-bold text-primary/80">
            예: "강남역"
          </p>
        </div>

        {/* --- 미니 비주얼라이저 (Mini Visualizer) --- */}
        {/* 사용자가 다시 말하도록 유도하는 움직이는 파형 애니메이션 */}
        <div className="h-24 flex items-center justify-center gap-2">
          <div className="w-2 bg-primary rounded-full h-8 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="w-2 bg-primary rounded-full h-16 animate-[wave_0.8s_ease-in-out_infinite_0.1s]"></div>
          <div className="w-2 bg-primary rounded-full h-12 animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></div>
          <div className="w-2 bg-primary rounded-full h-20 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="w-2 bg-primary rounded-full h-10 animate-[wave_0.9s_ease-in-out_infinite_0.1s]"></div>
        </div>

        {/* 마이크 아이콘 (깜빡임 효과) */}
        <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center animate-pulse">
          <span className="material-icons-round text-primary text-4xl">mic</span>
        </div>
      </div>

      {/* --- 하단 사용 팁 (Instructions) --- */}
      {/* pointer-events-none: 텍스트를 눌러도 뒤쪽 배경(취소)이 눌리도록 설정 */}
      <div className="w-full pb-12 z-10 pointer-events-none">
        {/* 팁 박스 (Glassmorphism 스타일) */}
        <div className="bg-zinc-900/50 border-2 border-primary/20 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg mb-6">
          <p className="text-lg md:text-xl text-primary font-bold leading-relaxed">
            "아니, <span className="text-white bg-primary/20 px-1 rounded mx-1">목적지</span>"라고<br />
            말씀하셔도 됩니다
          </p>
        </div>
        {/* 취소 방법 안내 */}
        <p className="text-center text-primary/40 text-sm font-semibold uppercase tracking-widest">
          화면을 터치하여 취소
        </p>
      </div>
    </div>
  );
};

export default RetryScreen;
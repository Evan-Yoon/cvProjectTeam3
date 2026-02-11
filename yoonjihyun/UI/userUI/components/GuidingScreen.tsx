import React, { useState, useEffect } from 'react';

// Props 인터페이스 정의
// onEndNavigation: 안내를 종료하고 싶을 때 실행할 함수 (부모 컴포넌트에서 받아옴)
interface GuidingScreenProps {
  onEndNavigation: () => void;
}

const GuidingScreen: React.FC<GuidingScreenProps> = ({ onEndNavigation }) => {
  // 탭 횟수를 저장하는 State (초기값 0)
  const [taps, setTaps] = useState(0);

  // 탭 횟수(taps)가 변할 때마다 실행되는 로직 (useEffect)
  useEffect(() => {
    // 1. 탭이 3번 이상 되면 안내 종료 함수 실행
    if (taps >= 3) {
      onEndNavigation();
    }

    // 2. 연속 탭 타이머 로직 (Reset logic)
    // 사용자가 탭을 하고 1초(1000ms) 동안 아무것도 안 하면 횟수를 0으로 리셋합니다.
    // 즉, "따닥!" 하고 빨리 누르지 않으면 횟수가 초기화되어 오작동을 방지합니다.
    const timer = setTimeout(() => {
      if (taps > 0) setTaps(0);
    }, 1000);

    // 컴포넌트가 사라지거나 업데이트될 때 타이머를 정리(Cleanup)해줍니다.
    return () => clearTimeout(timer);
  }, [taps, onEndNavigation]); // taps나 onEndNavigation이 바뀔 때마다 이 효과가 재실행됨

  // 화면을 터치(클릭)했을 때 실행되는 함수
  // 기존 횟수(prev)에 +1을 합니다.
  const handleTap = () => {
    setTaps(prev => prev + 1);
  };

  return (
    <div
      // 전체 화면 컨테이너
      // h-full w-full: 전체 화면 채움
      // onClick={handleTap}: 화면 **어디를 눌러도** 탭 횟수가 올라가도록 설정 (접근성 핵심)
      // select-none: 텍스트 드래그 방지
      className="h-full w-full bg-black flex flex-col items-center justify-center relative select-none touch-manipulation cursor-pointer"
      onClick={handleTap}
    >
      {/* 중앙 메인 텍스트 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6">
        {/* "안내 중..." 텍스트 (반짝이는 효과 animate-pulse 적용) */}
        <h1 className="text-6xl sm:text-7xl font-black leading-tight text-center tracking-tighter text-primary animate-pulse">
          안내 중...
        </h1>
      </div>

      {/* 하단 안내 문구 영역 */}
      {/* pointer-events-none: 글자를 눌러도 부모 div의 클릭 이벤트가 발생하도록 설정 */}
      <div className="pb-16 px-8 text-center flex flex-col gap-6 pointer-events-none">

        {/* 음성 명령 안내 */}
        <p className="text-3xl md:text-4xl font-extrabold text-primary leading-tight">
          "안내 종료"라고<br />말해보세요
        </p>

        {/* 제스처(탭) 안내 및 현재 탭 횟수 표시 */}
        {/* ({taps}/3) 부분을 통해 현재 몇 번 눌렀는지 시각적으로 보여줌 */}
        <p className="text-sm md:text-base font-medium text-white opacity-60 leading-relaxed">
          또는 화면을 3번 탭하면 안내가 종료됩니다 ({taps}/3)
        </p>
      </div>
    </div>
  );
};

export default GuidingScreen;
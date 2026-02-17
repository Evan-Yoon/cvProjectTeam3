import React, { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { reverseGeoCoding, searchNearbyPoi } from '../src/api/tmap';
import { speak } from '../src/utils/audio';

// Props 인터페이스 정의
// onStart: 화면을 터치했을 때 실행할 함수 (앱 시작 기능)
interface IdleScreenProps {
  onStart: () => void;
  isLocationReady: boolean;
}

const IdleScreen: React.FC<IdleScreenProps> = ({ onStart, isLocationReady }) => {
  const [currentAddress, setCurrentAddress] = useState<string>("위치 확인 중...");

  useEffect(() => {
    if (isLocationReady) {
      setCurrentAddress("위치 확인 완료");
      speak("현재 위치를 확인했습니다. 어디로 안내할까요?");
      // 자동으로 넘어가는 기능이 필요하다면 여기서 호출 (유저 요청: "app needs to really find my location -> and then ask")
      // 즉, 위치 찾고 -> 물어보고 -> 리스닝 (현재 흐름 유지)
      // 단, 너무 빨리 넘어가면 "위치 확인 완료"를 못 볼 수 있음. 
      // 기존 코드는 바로 onStart() 호출했음.
      const timer = setTimeout(() => {
        onStart();
      }, 2000); // 2초 뒤 자동 시작
      return () => clearTimeout(timer);
    } else {
      setCurrentAddress("위치 확인 중...");
      speak("위치 정보를 찾고 있습니다.");
    }
  }, [isLocationReady]);

  return (
    <div
      // 전체 화면 컨테이너
      // h-full w-full: 전체 화면 채움
      // flex-col justify-between: 상단, 중단, 하단 요소를 세로로 배치하고 간격을 벌림
      // cursor-pointer, onClick={onStart}: 화면 전체가 클릭 가능한 버튼 역할을 함
      // active:bg-zinc-900: 터치했을 때 배경색이 살짝 어두워지는 피드백 제공
      className="h-full w-full flex flex-col items-center justify-between py-12 px-6 cursor-pointer active:bg-zinc-900 transition-colors duration-200 relative"
      onClick={onStart}
    >
      {/* --- 상단 상태 영역 (설정/히스토리 버튼) --- */}
      <div className="w-full flex justify-between items-start z-20">
        {/* 설정 버튼 */}
        {/* onClick 이벤트가 상위 div로 전파되지 않도록 하려면 e.stopPropagation()이 필요할 수 있음 */}
        <button className="p-4 rounded-xl hover:bg-zinc-800 transition-colors" aria-label="Settings">
          <span className="material-icons-round text-4xl text-zinc-500">settings</span>
        </button>
        {/* 히스토리(기록) 버튼 */}
        <button className="p-4 rounded-xl hover:bg-zinc-800 transition-colors" aria-label="History">
          <span className="material-icons-round text-4xl text-zinc-500">history</span>
        </button>
      </div>

      {/* --- 중앙 콘텐츠 영역 (마이크 아이콘 & 로고) --- */}
      {/* flex-grow: 남은 공간을 모두 차지하여 중앙에 위치하도록 함 */}
      {/* pointer-events-none: 중앙 요소를 클릭해도 뒤쪽의 메인 div 클릭 이벤트가 발생하도록 설정 */}
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-sm relative z-10 pointer-events-none">

        {/* 배경 빛 효과 (Glowing Background) */}
        {/* 은은하게 퍼지는 노란색 빛 (WalkMate 브랜드 컬러) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-64 h-64 rounded-full bg-primary/20 blur-3xl animate-pulse-slow"></div>
        </div>

        {/* 메인 마이크 아이콘 */}
        <div className="relative mb-12">
          {/* 검은색 원형 배경 + 노란색 테두리 + 마이크 아이콘 */}
          <div className="w-48 h-48 rounded-full border-4 border-primary flex items-center justify-center bg-black shadow-[0_0_50px_rgba(253,189,16,0.15)]">
            <span className="material-icons-round text-9xl text-primary">mic</span>
          </div>

          {/* 상태 표시 알약 (Status Pill) */}
          {/* 하단에 '대기 중'이라고 떠있는 작은 뱃지 */}
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 px-6 py-2 rounded-full flex items-center gap-2 shadow-xl whitespace-nowrap">
            {/* 초록색 점 깜빡임 (작동 중임을 표시) */}
            <div className={`w-3 h-3 rounded-full animate-pulse ${currentAddress.includes("실패") ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <span className="text-sm font-bold tracking-wider text-zinc-300 uppercase max-w-[200px] truncate">
              {currentAddress}
            </span>
          </div>
        </div>

        {/* 텍스트 (앱 이름) */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            Walk<span className="text-primary">Mate</span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium">
            접근성 모드 활성화됨
          </p>
        </div>
      </div>

      {/* --- 하단 행동 유도 문구 (Call to Action) --- */}
      <div className="w-full z-10 pointer-events-none text-center">
        <div className="space-y-8">
          {/* 음성 명령 가이드 */}
          <h2 className="text-3xl font-bold text-primary tracking-wide drop-shadow-lg break-keep leading-snug">
            "안내 시작"이라고<br />말해보세요
          </h2>

          {/* 터치 가이드 */}
          <div className="relative">
            {/* 화살표 애니메이션 (위아래로 움직임) */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center opacity-50">
              <span className="material-icons-round text-zinc-500 text-2xl animate-bounce">keyboard_arrow_down</span>
            </div>
            <p className="text-xl font-medium text-white/80 tracking-wide">
              또는 어디든 터치하여 시작하기
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdleScreen;

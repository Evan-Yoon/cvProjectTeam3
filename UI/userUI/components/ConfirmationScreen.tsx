import React, { useRef } from 'react';
import { useVoiceDialog } from '@/src/hooks/useVoiceDialog';
import { stopListening } from '@/src/utils/audio';

// 1. Props 인터페이스 정의
// 이 컴포넌트가 부모로부터 받아야 할 데이터와 함수의 타입을 지정합니다.
interface ConfirmationScreenProps {
    destination: string;    // 사용자가 입력한 목적지 (예: "강남역")
    onConfirm: () => void;  // "네/응" 이라고 하거나 화면을 눌러 확정했을 때 실행될 함수
    onDeny: () => void;     // "아니오" 라고 하거나 취소했을 때 실행될 함수
}

// 2. 컴포넌트 선언
const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ destination, onConfirm, onDeny }) => {
    // 확인 화면은 "응/아니" 음성 입력과 화면 상하단 터치를 모두 지원합니다.
    // 두 입력이 거의 동시에 들어올 수 있어서 hasFinalized로 한 번만 처리되게 합니다.
    const hasFinalized = useRef(false);

    const handleConfirm = () => {
        // 확인이 확정되면 STT를 멈추고 부모의 경로 탐색 함수(App.tsx)를 호출합니다.
        if (hasFinalized.current) return;
        hasFinalized.current = true;
        stopListening();
        onConfirm();
    };

    const handleDeny = () => {
        // 거절이 확정되면 STT를 멈추고 부모의 재시도 화면 전환 함수(App.tsx)를 호출합니다.
        if (hasFinalized.current) return;
        hasFinalized.current = true;
        stopListening();
        onDeny();
    };

    // "응/아니오" 판단 및 부모 핸들러 트리거
    const handleCommandResult = (text: string) => {
        const command = text.toLowerCase().trim();
        console.log("Confirmation STT:", command);

        // includes를 쓰기 때문에 "네 맞아요", "아니요"처럼 긴 문장 안에 키워드가 있어도 인식됩니다.
        if (["응", "네", "맞아", "그래", "yes", "ok", "어", "맞음"].some(k => command.includes(k))) {
            handleConfirm();
        } else if (["아니", "틀려", "no", "nope", "아니야", "아님"].some(k => command.includes(k))) {
            handleDeny();
        }
    };

    useVoiceDialog({
        promptMessage: `${destination}이 맞으신가요?`,
        onFinalResult: handleCommandResult,
    });

    return (
        // 전체 화면 컨테이너
        // h-full w-full: 전체 화면 채움
        // relative overflow-hidden: 배경 장식 요소들이 화면 밖으로 나가지 않도록 자름
        <div className="h-full w-full flex flex-col items-center justify-between relative overflow-hidden">

            {/* --- 배경 시각 효과 (Background Ambient Effects) --- */}
            {/* aria-hidden="true": 스크린 리더가 읽지 않도록 설정 (장식용) */}
            {/* 은은하게 빛나는 배경 효과를 위해 animate-pulse(깜빡임)와 spin(회전) 애니메이션 적용 */}
            <div aria-hidden="true" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl animate-pulse"></div>
            <div aria-hidden="true" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full border border-primary/20 animate-spin-slow"></div>

            {/* --- 메인 콘텐츠 영역 --- */}
            <main className="flex-1 w-full flex flex-col items-center justify-center relative z-20 px-6">

                {/* 시각적 아이콘 (마이크) */}
                <div className="mb-12 relative">
                    {/* 중앙 마이크 아이콘 원형 배경 */}
                    <div className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary z-10 relative">
                        <span className="material-icons-round text-6xl text-primary">mic</span>
                    </div>
                    {/* 물결(Ripple) 애니메이션 효과: 음성 인식 중임을 시각적으로 표현 */}
                    <div className="absolute inset-0 rounded-full border border-primary/30 scale-110 animate-pulse"></div>
                    <div
                        className="absolute inset-0 rounded-full border border-primary/10 scale-150 animate-pulse"
                        style={{ animationDelay: '0.5s' }}
                    ></div>
                </div>

                {/* 텍스트 내용 */}
                <div className="text-center space-y-6">
                    {/* 인식된 목적지 텍스트 (가장 크게 강조) */}
                    <h1 className="text-6xl font-black text-primary tracking-tight leading-tight drop-shadow-2xl whitespace-pre-wrap">
                        {/* 괄호/대괄호 앞에서 줄바꿈해 긴 POI 이름이 한 줄에 터지지 않게 합니다. */}
                        {destination.replace(/([\[\(])/g, '\n$1')}
                    </h1>
                    {/* 확인 질문 */}
                    <p className="text-3xl font-bold text-white tracking-tight">
                        맞으신가요?
                    </p>
                </div>
            </main>

            {/* --- 투명 터치 영역 (Invisible Overlay) --- */}
            {/* 중요: 시각장애인을 위해 작은 버튼 대신 화면 전체를 터치 영역으로 사용합니다. */}
            {/* 화면을 시각적으로 가리지 않지만(z-10), 터치 이벤트는 받습니다. */}
            <div className="absolute inset-0 z-10 flex flex-col">
                {/* 화면 상단 절반: 클릭 시 '확인(onConfirm)' 실행 */}
                <button
                    className="flex-1 w-full outline-none focus:bg-primary/5 active:bg-primary/10 transition-colors"
                    onClick={handleConfirm}
                    aria-label="Confirm Destination" // 스크린 리더용 라벨
                ></button>
                {/* 화면 하단 절반: 클릭 시 '취소(onDeny)' 실행 */}
                <button
                    className="flex-1 w-full outline-none focus:bg-red-500/5 active:bg-red-500/10 transition-colors"
                    onClick={handleDeny}
                    aria-label="Deny Destination"
                ></button>
            </div>

            {/* --- 하단 안내 문구 (Footer) --- */}
            <footer className="w-full max-w-md p-8 relative z-20 text-center pb-12 pointer-events-none">
                {/* 반투명 박스 디자인 (Glassmorphism) */}
                <div className="inline-flex items-center justify-center gap-4 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl px-8 py-5 shadow-2xl">
                    {/* 오디오 파형 아이콘 */}
                    <span className="material-icons-round text-primary animate-pulse text-2xl">graphic_eq</span>
                    {/* 음성 명령 가이드 텍스트 */}
                    <p className="text-zinc-300 font-medium text-lg">
                        <span className="text-white font-bold">"응"</span> 또는 <span className="text-white font-bold">"아니"</span>라고 말씀해주세요
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ConfirmationScreen;

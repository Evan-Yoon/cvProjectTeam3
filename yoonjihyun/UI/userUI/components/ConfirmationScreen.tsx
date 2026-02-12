import React, { useEffect, useRef } from 'react';
import { speak, startListening, stopListening } from './utils/audio';

// 1. Props 인터페이스 정의
// 이 컴포넌트가 부모로부터 받아야 할 데이터와 함수의 타입을 지정합니다.
interface ConfirmationScreenProps {
    destination: string;    // 사용자가 입력한 목적지 (예: "강남역")
    onConfirm: () => void;  // "네/응" 이라고 하거나 화면을 눌러 확정했을 때 실행될 함수
    onDeny: () => void;     // "아니오" 라고 하거나 취소했을 때 실행될 함수
}

// 2. 컴포넌트 선언
const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ destination, onConfirm, onDeny }) => {
    const isMounted = useRef(true);

    const handleSTT = async () => {
        await startListening(
            (text) => {
                const command = text.toLowerCase().trim();
                console.log("Confirmation STT:", command);

                if (["응", "네", "맞아", "yes", "ok", "어"].some(k => command.includes(k))) {
                    if (isMounted.current) onConfirm();
                } else if (["아니", "틀려", "no", "nope"].some(k => command.includes(k))) {
                    if (isMounted.current) onDeny();
                } else {
                    // Not understood, maybe prompt again? For now, just listen again.
                    // Or users can allow retrying manually by tapping.
                    // Let's just log it.
                }
            },
            () => {
                console.log("Confirmation STT failed");
            }
        );
    };

    useEffect(() => {
        isMounted.current = true;
        speak(`${destination}이 맞으신가요?`);

        const timer = setTimeout(() => {
            if (isMounted.current) handleSTT();
        }, 3000); // Wait for TTS

        return () => {
            isMounted.current = false;
            clearTimeout(timer);
            stopListening();
        };
    }, [destination]);

    return (
        // 전체 화면 컨테이너
        // h-full w-full: 전체 화면 채움
        // relative overflow-hidden: 배경 장식 요소들이 화면 밖으로 나가지 않도록 자름
        <div className="h-full w-full flex flex-col items-center justify-between relative overflow-hidden">

            {/* --- 배경 시각 효과 (Background Ambient Effects) --- */}
            {/* aria-hidden="true": 스크린 리더가 읽지 않도록 설정 (장식용) */}
            {/* 은은하게 빛나는 배경 효과를 위해 animate-pulse(깜빡임)와 spin(회전) 애니메이션 적용 */}
            <div aria-hidden="true" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl animate-pulse"></div>
            <div aria-hidden="true" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full border border-primary/20 animate-[spin_12s_linear_infinite]"></div>

            {/* --- 상단 상태 표시줄 (가짜 UI) --- */}
            {/* 실제 기능은 없지만 앱처럼 보이게 하는 시각적 요소 (시간, 배터리 등) */}
            <div className="w-full flex justify-between px-6 py-4 absolute top-0 z-50 text-white/30 text-xs font-bold uppercase tracking-widest pointer-events-none">
                {/* 텍스트는 보이지만 클릭은 안 되게 pointer-events-none 설정 */}
                <span>WalkMate</span>
                <div className="flex gap-2">
                    <span className="material-icons-round text-base">wifi</span>
                    <span className="material-icons-round text-base">battery_full</span>
                </div>
            </div>

            {/* --- 메인 콘텐츠 영역 --- */}
            <main className="flex-1 w-full flex flex-col items-center justify-center relative z-20 px-6">

                {/* 시각적 아이콘 (마이크) */}
                <div className="mb-12 relative">
                    {/* 중앙 마이크 아이콘 원형 배경 */}
                    <div className="w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary z-10 relative">
                        <span className="material-icons-round text-6xl text-primary">mic</span>
                    </div>
                    {/* 물결(Ripple) 애니메이션 효과: 음성 인식 중임을 시각적으로 표현 */}
                    <div className="absolute inset-0 rounded-full border border-primary/30 scale-110 animate-[pulse_2s_infinite]"></div>
                    <div className="absolute inset-0 rounded-full border border-primary/10 scale-150 animate-[pulse_2s_infinite_0.5s]"></div>
                </div>

                {/* 텍스트 내용 */}
                <div className="text-center space-y-6">
                    {/* 인식된 목적지 텍스트 (가장 크게 강조) */}
                    <h1 className="text-6xl font-black text-primary tracking-tight leading-tight drop-shadow-2xl">
                        {destination}
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
                    onClick={() => { stopListening(); onConfirm(); }}
                    aria-label="Confirm Destination" // 스크린 리더용 라벨
                ></button>
                {/* 화면 하단 절반: 클릭 시 '취소(onDeny)' 실행 */}
                <button
                    className="flex-1 w-full outline-none focus:bg-red-500/5 active:bg-red-500/10 transition-colors"
                    onClick={() => { stopListening(); onDeny(); }}
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
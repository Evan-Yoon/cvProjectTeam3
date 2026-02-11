import React from 'react';

interface IdleScreenProps {
  onStart: () => void;
}

const IdleScreen: React.FC<IdleScreenProps> = ({ onStart }) => {
  return (
    <div 
      className="h-full w-full flex flex-col items-center justify-between py-12 px-6 cursor-pointer active:bg-zinc-900 transition-colors duration-200 relative"
      onClick={onStart}
    >
      {/* Top Status Area */}
      <div className="w-full flex justify-between items-start z-20">
        <button className="p-4 rounded-xl hover:bg-zinc-800 transition-colors" aria-label="Settings">
          <span className="material-icons-round text-4xl text-zinc-500">settings</span>
        </button>
        <button className="p-4 rounded-xl hover:bg-zinc-800 transition-colors" aria-label="History">
          <span className="material-icons-round text-4xl text-zinc-500">history</span>
        </button>
      </div>

      {/* Center Content */}
      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-sm relative z-10 pointer-events-none">
        {/* Glowing Background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-64 h-64 rounded-full bg-primary/20 blur-3xl animate-pulse-slow"></div>
        </div>

        {/* Main Mic Icon */}
        <div className="relative mb-12">
          <div className="w-48 h-48 rounded-full border-4 border-primary flex items-center justify-center bg-black shadow-[0_0_50px_rgba(253,189,16,0.15)]">
            <span className="material-icons-round text-9xl text-primary">mic</span>
          </div>
          {/* Status Pill */}
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 px-6 py-2 rounded-full flex items-center gap-2 shadow-xl">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-bold tracking-wider text-zinc-300 uppercase">대기 중</span>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            Walk<span className="text-primary">Mate</span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium">
            접근성 모드 활성화됨
          </p>
        </div>
      </div>

      {/* Bottom Call to Action */}
      <div className="w-full z-10 pointer-events-none text-center">
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-primary tracking-wide drop-shadow-lg break-keep leading-snug">
            "안내 시작"이라고<br/>말해보세요
          </h2>
          <div className="relative">
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
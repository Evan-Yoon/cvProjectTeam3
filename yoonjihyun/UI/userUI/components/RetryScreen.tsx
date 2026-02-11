import React from 'react';

interface RetryScreenProps {
  onCancel: () => void;
  onSpeechDetected: () => void;
}

const RetryScreen: React.FC<RetryScreenProps> = ({ onCancel, onSpeechDetected }) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-between p-6 relative z-10">
      {/* Background Click to Cancel */}
      <div 
        className="absolute inset-0 z-0" 
        onClick={onCancel}
        aria-label="Cancel retry"
      ></div>

      {/* Header */}
      <div className="w-full flex justify-between items-center text-primary/60 pt-2 px-2 z-10 pointer-events-none">
        <span className="text-sm font-semibold tracking-wider">WALKMATE</span>
        <div className="flex gap-1">
            <span className="material-icons-round text-sm">wifi</span>
            <span className="material-icons-round text-sm">battery_full</span>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex flex-col items-center justify-center w-full space-y-12 z-20 cursor-pointer"
        onClick={(e) => {
             e.stopPropagation(); // prevent canceling
             onSpeechDetected();
        }}
      >
        <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tight leading-tight drop-shadow-lg">
                다시<br/>말씀해주세요
            </h1>
            <p className="text-xl md:text-2xl font-bold text-primary/80">
                예: "강남역"
            </p>
        </div>

        {/* Mini Visualizer */}
        <div className="h-24 flex items-center justify-center gap-2">
             <div className="w-2 bg-primary rounded-full h-8 animate-[wave_1s_ease-in-out_infinite]"></div>
             <div className="w-2 bg-primary rounded-full h-16 animate-[wave_0.8s_ease-in-out_infinite_0.1s]"></div>
             <div className="w-2 bg-primary rounded-full h-12 animate-[wave_1.2s_ease-in-out_infinite_0.2s]"></div>
             <div className="w-2 bg-primary rounded-full h-20 animate-[wave_1s_ease-in-out_infinite]"></div>
             <div className="w-2 bg-primary rounded-full h-10 animate-[wave_0.9s_ease-in-out_infinite_0.1s]"></div>
        </div>

        <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center animate-pulse">
            <span className="material-icons-round text-primary text-4xl">mic</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="w-full pb-12 z-10 pointer-events-none">
        <div className="bg-zinc-900/50 border-2 border-primary/20 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg mb-6">
            <p className="text-lg md:text-xl text-primary font-bold leading-relaxed">
                "아니, <span className="text-white bg-primary/20 px-1 rounded mx-1">목적지</span>"라고<br/>
                말씀하셔도 됩니다
            </p>
        </div>
        <p className="text-center text-primary/40 text-sm font-semibold uppercase tracking-widest">
            화면을 터치하여 취소
        </p>
      </div>
    </div>
  );
};

export default RetryScreen;
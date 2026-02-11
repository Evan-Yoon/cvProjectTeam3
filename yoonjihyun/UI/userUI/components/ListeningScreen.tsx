import React, { useEffect } from 'react';

interface ListeningScreenProps {
  onCancel: () => void;
  onSpeechDetected: () => void;
}

const ListeningScreen: React.FC<ListeningScreenProps> = ({ onCancel, onSpeechDetected }) => {
  // Simulate speech detection after a random delay for demo purposes
  // In a real app, this would be triggered by the Web Speech API
  useEffect(() => {
    const timer = setTimeout(() => {
      onSpeechDetected();
    }, 3500); // Wait 3.5 seconds then auto-detect "Gangnam Station"
    return () => clearTimeout(timer);
  }, [onSpeechDetected]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-between pt-24 pb-12 px-6 relative z-10">
      {/* Background Cancel Click Area */}
      <div 
        className="absolute inset-0 z-0" 
        onClick={onCancel} 
        aria-label="화면 아무 곳이나 눌러서 취소"
      ></div>

      {/* Top Content */}
      <section className="w-full text-center space-y-6 animate-fade-in-up pointer-events-none z-10">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/30">
          <span className="material-icons-round text-primary text-4xl">mic</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.3] tracking-tight break-keep">
          어디로 가고<br/>싶으신가요?
        </h1>
        <p className="text-xl text-primary font-bold animate-pulse">
          듣고 있습니다...
        </p>
      </section>

      {/* Audio Visualizer */}
      <section 
        className="flex-1 flex items-center justify-center w-full py-12 pointer-events-auto z-20 cursor-pointer"
        onClick={onSpeechDetected} // Allow instant click to simulate speaking
        title="Click to simulate speaking 'Gangnam Station'"
      >
        <div className="relative w-full h-48 flex items-center justify-center gap-2 md:gap-4">
           {/* Background Glow */}
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transform scale-150"></div>
          
          {/* Bars */}
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-12 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-20 animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-32 animate-[wave_0.8s_ease-in-out_infinite_0.2s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-48 animate-[wave_1.5s_ease-in-out_infinite_0.15s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-24 animate-[wave_1.1s_ease-in-out_infinite_0.4s]"></div>
          <div className="wave-bar w-3 md:w-4 bg-primary rounded-full h-16 animate-[wave_0.9s_ease-in-out_infinite_0.25s]"></div>
        </div>
      </section>

      {/* Bottom Instruction */}
      <section className="w-full space-y-4 pointer-events-none z-10">
        <div className="h-12 w-full flex items-center justify-center text-zinc-500 text-sm font-medium">
          화면 아무 곳이나 눌러서 취소
        </div>
      </section>
    </div>
  );
};

export default ListeningScreen;
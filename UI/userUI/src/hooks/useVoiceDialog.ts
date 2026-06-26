import { useEffect, useRef } from 'react';
import { speak, startListening, stopListening } from '@/src/utils/audio';

interface UseVoiceDialogParams {
  promptMessage: string;
  onFinalResult: (text: string) => void;
  autoStart?: boolean;
}

export const useVoiceDialog = ({
  promptMessage,
  onFinalResult,
  autoStart = true,
}: UseVoiceDialogParams) => {
  const isMounted = useRef(true);
  const latestText = useRef<string>('');
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasFinalized = useRef(false);

  const finalize = (text: string) => {
    if (hasFinalized.current) return;
    hasFinalized.current = true;
    stopListening();
    onFinalResult(text);
  };

  const resetSilenceTimer = (currentText: string) => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);

    silenceTimer.current = setTimeout(() => {
      if (isMounted.current && currentText.trim()) {
        console.log("🤫 [useVoiceDialog] 침묵 감지 -> 자동 확정:", currentText);
        finalize(currentText);
      }
    }, 1300); // 1.3초 침묵 기준
  };

  const startSpeechFlow = async () => {
    if (!isMounted.current) return;
    hasFinalized.current = false;
    latestText.current = '';

    await speak(promptMessage);

    // 오디오 녹음 전환 시간 확보용 대기
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!isMounted.current) return;

    await startListening(
      (finalResult) => {
        const resultText = finalResult || latestText.current;
        console.log("🎤 [useVoiceDialog] STT 최종 결과 수신:", resultText);
        if (isMounted.current) {
          finalize(resultText);
        }
      },
      () => {
        console.log("⚠️ [useVoiceDialog] STT 실패");
      },
      (partialText) => {
        latestText.current = partialText;
        resetSilenceTimer(partialText);
      }
    );
  };

  // 수동 텍스트 확정 (화면 터치 시)
  const triggerManualConfirm = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    stopListening();
    const confirmedText = latestText.current.trim();
    finalize(confirmedText || "ERROR_NOT_FOUND");
  };

  // 수동으로 다시 듣기 시작 (재시도 클릭 시)
  const triggerManualStart = async () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    stopListening();
    await startSpeechFlow();
  };

  useEffect(() => {
    isMounted.current = true;

    if (autoStart) {
      startSpeechFlow();
    } else {
      // autoStart가 false인 경우 말만 하고 마이크 활성화 대기는 하지 않음
      speak(promptMessage);
    }

    return () => {
      isMounted.current = false;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      stopListening();
    };
  }, [promptMessage, autoStart]);

  return {
    latestText,
    isMounted,
    triggerManualConfirm,
    triggerManualStart,
  };
};

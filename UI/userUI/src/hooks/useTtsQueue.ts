import { useEffect, useRef } from 'react';
import { speak } from '@/src/utils/audio';
import { TtsMessage } from '../../types';

export const useTtsQueue = () => {
  const ttsQueue = useRef<TtsMessage[]>([]);
  const isSpeaking = useRef<boolean>(false);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef<boolean>(true);

  const processTtsQueue = async () => {
    if (!isMounted.current) return;
    if (isSpeaking.current || ttsQueue.current.length === 0) return;
    isSpeaking.current = true;

    // 장애물(isObstacle: true) 멘트가 있으면 최우선으로 재생
    const obstacleIndex = ttsQueue.current.findIndex((m) => m.isObstacle);
    const indexToPlay = obstacleIndex !== -1 ? obstacleIndex : 0;
    const msg = ttsQueue.current.splice(indexToPlay, 1)[0];

    await speak(msg.text);

    // 발화 완료 대기를 위해 글자 수 비례 대기 시간 적용 (기본 최소 1.5초)
    const waitTime = Math.max(1500, msg.text.length * 150);
    timeoutId.current = setTimeout(() => {
      isSpeaking.current = false;
      if (isMounted.current) {
        processTtsQueue();
      }
    }, waitTime);
  };

  const safeSpeak = (text: string, isObstacle: boolean = false) => {
    if (!text || !isMounted.current) return;

    // 완전히 똑같은 문장이 이미 큐에 대기 중이면 중복 추가 차단
    if (
      ttsQueue.current.some(
        (m) => m.text === text && m.isObstacle === isObstacle
      )
    ) {
      return;
    }

    ttsQueue.current.push({ text, isObstacle });
    processTtsQueue();
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, []);

  return {
    safeSpeak,
    isSpeaking,
  };
};

// src/utils/audio.ts
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const speak = async (text: string) => {
    if (isNative) {
        try {
            await TextToSpeech.stop();
            await TextToSpeech.speak({
                text: text,
                lang: 'ko-KR',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'ambient',
            });
        } catch (e) {
            console.error("TTS 에러:", e);
        }
    } else {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            window.speechSynthesis.speak(utterance);
        }
    }
};

let isListeningActive = false;

export const startListening = async (
    onResult: (text: string) => void,
    onError: () => void,
    onPartial?: (text: string) => void
) => {
    if (isListeningActive) {
        console.warn("STT가 이미 작동 중입니다. 중복 호출을 차단합니다.");
        return;
    }
    isListeningActive = true;

    if (isNative) {
        try {
            const { available } = await SpeechRecognition.available();

            if (available) {
                // 권한 요청
                await SpeechRecognition.requestPermissions();

                // 1. 리스너 등록 (실시간 인식 조각을 받아와 상위 컴포넌트로 전달)
                await SpeechRecognition.removeAllListeners();
                await SpeechRecognition.addListener('partialResults', (data: any) => {
                    if (data.matches && data.matches.length > 0) {
                        console.log("Partial result:", data.matches[0]);
                        if (onPartial) {
                            onPartial(data.matches[0]);
                        }
                    }
                });

                // 2. 인식 시작 (iOS의 원활한 동작을 위해 partialResults를 true로 활성화합니다)
                const result = await SpeechRecognition.start({
                    language: "ko-KR",
                    maxResults: 1,
                    prompt: "말씀해주세요...",
                    partialResults: true,
                    popup: false,
                });

                isListeningActive = false; // 완료 시 락 해제

                // 3. 최종 결과값 확인
                if (result && result.matches && result.matches.length > 0) {
                    console.log("Final result:", result.matches[0]);
                    onResult(result.matches[0]); // 인식된 텍스트 전달
                } else {
                    console.log("결과 없음");
                }

            } else {
                console.error("음성 인식을 사용할 수 없는 기기입니다.");
                isListeningActive = false;
                onError();
            }
        } catch (e) {
            console.error("STT 에러:", e);
            isListeningActive = false; // 에러 시 락 해제
            onError();
        }
    } else {
        // 웹 시뮬레이션
        console.log("웹: 시뮬레이션 실행");
        setTimeout(() => {
            isListeningActive = false;
            onResult("강남역");
        }, 2000);
    }
};

export const stopListening = async () => {
    isListeningActive = false; // 중지 시 락 해제
    if (isNative) {
        try {
            await SpeechRecognition.stop();
        } catch (e) {
            console.log("Stop error", e);
        }
    }
};
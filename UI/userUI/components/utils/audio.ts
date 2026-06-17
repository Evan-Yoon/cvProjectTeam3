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

export const startListening = async (
    onResult: (text: string) => void,
    onError: () => void
) => {
    if (isNative) {
        try {
            const { available } = await SpeechRecognition.available();

            if (available) {
                // 권한 요청
                await SpeechRecognition.requestPermissions();

                // ★ 핵심 수정: 리스너도 등록하고, start의 결과값도 확인하는 이중 안전장치

                // 1. 리스너 등록 (혹시 모를 실시간 인식 대비)
                await SpeechRecognition.removeAllListeners();
                await SpeechRecognition.addListener('partialResults', (data: any) => {
                    if (data.matches && data.matches.length > 0) {
                        console.log("Partial result:", data.matches[0]);
                        // 부분 결과는 필요하면 여기서 처리 (지금은 최종 결과 위주로)
                    }
                });

                // 2. 인식 시작 (popup: true 사용 시 구글 UI가 뜹니다)
                // ★ 중요: await를 걸어서 인식이 끝날 때까지 기다립니다.
                const result = await SpeechRecognition.start({
                    language: "ko-KR",
                    maxResults: 1,
                    prompt: "말씀해주세요...",
                    partialResults: false,
                    popup: true, // 구글 UI 띄우기 (테스트에 유리)
                });

                // 3. ★ 결과값 확인 (popup: true일 때는 여기서 결과가 들어옵니다!)
                if (result && result.matches && result.matches.length > 0) {
                    console.log("Final result:", result.matches[0]);
                    onResult(result.matches[0]); // 인식된 텍스트 전달
                } else {
                    console.log("결과 없음");
                }

            } else {
                console.error("음성 인식을 사용할 수 없는 기기입니다.");
                onError();
            }
        } catch (e) {
            console.error("STT 에러:", e);
            onError();
        }
    } else {
        // 웹 시뮬레이션
        console.log("웹: 시뮬레이션 실행");
        setTimeout(() => {
            onResult("강남역");
        }, 2000);
    }
};

export const stopListening = async () => {
    if (isNative) {
        try {
            await SpeechRecognition.stop();
        } catch (e) {
            console.log("Stop error", e);
        }
    }
};
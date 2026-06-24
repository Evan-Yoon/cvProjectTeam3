import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

// audio.ts는 앱 전체에서 쓰는 음성 출력(TTS)과 음성 인식(STT)을 한 곳에 모은 유틸입니다.
// 네이티브 앱(iOS/Android)에서는 Capacitor 플러그인을 쓰고, 웹 개발환경에서는 브라우저 기능/시뮬레이션을 씁니다.

// Capacitor.isNativePlatform()은 현재 실행 환경이 iOS/Android 네이티브 앱인지 확인합니다.
const isNative = Capacitor.isNativePlatform();
// STT 중복 시작을 막는 전역 잠금입니다. 여러 화면이 동시에 startListening을 부르면 마이크 리스너가 꼬일 수 있습니다.
let isListeningActive = false;

// ==========================================
// 1. 말하기 (TTS: Text To Speech)
// ==========================================
export const speak = async (text: string) => {
    if (isNative) {
        try {
            // 새 문장을 말하기 전에 기존 발화를 멈춥니다. 안내 문장이 겹쳐 들리는 것을 줄이기 위한 처리입니다.
            await TextToSpeech.stop();
            // 'ambient' 카테고리는 iOS에서 완료 콜백이 안 오는 경우가 있어
            // 'playback'으로 변경. 타임아웃 fallback도 추가.
            const ttsPromise = TextToSpeech.speak({
                text: text,
                lang: 'ko-KR',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                category: 'playback',
            });
            // 텍스트 길이 기반 최대 대기 시간 (글자당 ~300ms + 2초 여유)
            // 플러그인 Promise가 끝나지 않는 경우를 대비해 timeoutPromise와 race를 겁니다.
            const timeoutMs = Math.max(5000, text.length * 300 + 2000);
            const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
            await Promise.race([ttsPromise, timeoutPromise]);
        } catch (error) {
            console.error('TTS Error:', error);
        }
    } else {
        // 브라우저 개발환경에서는 Web Speech API의 speechSynthesis를 사용합니다.
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            window.speechSynthesis.speak(utterance);
        }
    }
};

// ==========================================
// 2. 듣기 (STT: Speech To Text)
// ==========================================
export const startListening = async (
    onResult: (text: string) => void,
    onError: () => void,
    onPartial?: (text: string) => void
) => {
    // 한 번에 하나의 STT 세션만 허용합니다. 중복 호출은 경고만 남기고 무시합니다.
    if (isListeningActive) {
        console.warn("STT가 이미 작동 중입니다. 중복 호출을 차단합니다.");
        return;
    }
    isListeningActive = true;

    if (isNative) {
        try {
            const { available } = await SpeechRecognition.available();
            console.log("🎙️ STT available:", available);

            if (available) {
                // 권한 요청 (iOS는 speechRecognition + microphone 둘 다 필요)
                const permission = await SpeechRecognition.requestPermissions();
                console.log("🎙️ STT permission:", JSON.stringify(permission));

                // iOS 플러그인 버전에 따라 키 이름이 다를 수 있으므로 양쪽 모두 확인
                const granted =
                    permission.speechRecognition === 'granted' ||
                    (permission as any)['speech-recognition'] === 'granted';

                if (!granted) {
                    console.error("Speech recognition permission denied:", JSON.stringify(permission));
                    isListeningActive = false;
                    onError();
                    return;
                }

                // 1. 리스너 등록
                // 이전 화면에서 남은 리스너가 중복 호출되지 않도록 전부 제거한 뒤 새 리스너를 등록합니다.
                await SpeechRecognition.removeAllListeners();
                await SpeechRecognition.addListener('partialResults', (data: any) => {
                    if (data.matches && data.matches.length > 0) {
                        console.log("Partial result:", data.matches[0]);
                        if (onPartial) {
                            onPartial(data.matches[0]);
                        }
                    } else if (data.value && data.value.length > 0) {
                        console.log("Partial value:", data.value[0]);
                        if (onPartial) {
                            onPartial(data.value[0]);
                        }
                    }
                });

                // 2. 인식 시작
                // partialResults: true라서 최종 결과 전에 중간 인식 결과를 계속 받을 수 있습니다.
                const result = await SpeechRecognition.start({
                    language: "ko-KR",
                    maxResults: 1,
                    prompt: "말씀해주세요...",
                    partialResults: true,
                    popup: false,
                });

                // iOS에서 start()는 즉시 undefined로 resolve됨 (비동기 결과는 partialResults 이벤트로만 옴).
                // 최종 결과가 있으면 onResult 호출, 없으면 무시하고 partialResults + 침묵 타이머에 맡김.
                if (result && result.matches && result.matches.length > 0) {
                    console.log("Final result:", result.matches[0]);
                    isListeningActive = false;
                    onResult(result.matches[0]);
                } else {
                    // 빈 결과는 오류가 아님 - iOS 정상 동작. partialResults 이벤트가 실제 결과를 전달함.
                    console.log("ℹ️ start() resolved empty - waiting for partialResults events...");
                    isListeningActive = false;
                    // onError() 호출하지 않음
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
        // 데스크톱 브라우저에서 네이티브 STT가 없을 때도 흐름을 테스트할 수 있게 2초 뒤 고정 문장을 반환합니다.
        console.log("웹: 시뮬레이션 실행");
        setTimeout(() => {
            isListeningActive = false;
            onResult("수원역");
        }, 2000);
    }
};

// 듣기 중단 함수
export const stopListening = async () => {
    // 어떤 이유로든 중단하면 다음 startListening이 가능하도록 잠금을 먼저 풉니다.
    isListeningActive = false; // 중지 시 락 해제
    if (isNative) {
        try {
            // 네이티브 마이크 인식과 partialResults 리스너를 함께 정리합니다.
            await SpeechRecognition.stop();
            await SpeechRecognition.removeAllListeners();
        } catch (error) {
            console.warn('STT Stop Warning:', error);
        }
    }
};

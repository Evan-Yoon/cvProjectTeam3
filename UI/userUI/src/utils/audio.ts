import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

// ==========================================
// 1. 말하기 (TTS: Text To Speech)
// ==========================================
export const speak = async (text: string) => {
    try {
        // 말하고 있는 중이라면 멈추고 새 말을 합니다.
        await TextToSpeech.stop();

        await TextToSpeech.speak({
            text: text,
            lang: 'ko-KR', // 한국어 설정
            rate: 1.0,     // 말하기 속도 (1.0 = 보통)
            pitch: 1.0,    // 목소리 톤
            volume: 1.0,   // 볼륨 (0.0 ~ 1.0)
        });
    } catch (error) {
        console.error('TTS Error:', error);
    }
};

// ==========================================
// 2. 듣기 (STT: Speech To Text)
// ==========================================
// 듣기 시작 함수
export const startListening = async (
    onResult: (text: string) => void, // 말을 인식했을 때 실행할 함수
    onEnd?: () => void                // 인식이 끝났을 때 실행할 함수
) => {
    try {
        // 1. STT 기능 사용 가능 여부 확인
        // ★ [수정 1] public이 아니라 available 속성을 가져옵니다.
        const { available } = await SpeechRecognition.available();

        if (!available) {
            console.error("STT not available");
            return;
        }

        // 2. 권한 요청
        // ★ [수정 2] microphone 속성을 제거하고 speechRecognition 권한만 확인합니다.
        const permission = await SpeechRecognition.requestPermissions();

        if (permission.speechRecognition !== 'granted') {
            console.error("Speech recognition permission denied");
            return;
        }

        // 3. 기존 리스너 제거 (중복 방지)
        await SpeechRecognition.removeAllListeners();

        // 4. 부분 결과 리스너 (말하는 도중에 계속 인식)
        SpeechRecognition.addListener('partialResults', (data: any) => {
            // 안드로이드에서는 matches 배열에 결과가 담겨옵니다.
            if (data.matches && data.matches.length > 0) {
                onResult(data.matches[0]); // 가장 정확한 첫 번째 결과 전달
            }
            // iOS 등 다른 플랫폼 호환성을 위해 value도 체크 (옵션)
            else if (data.value && data.value.length > 0) {
                onResult(data.value[0]);
            }
        });

        // 5. 듣기 시작
        await SpeechRecognition.start({
            language: "ko-KR", // 한국어 인식
            maxResults: 2,
            prompt: "말씀하세요...", // (안드로이드 구버전용 팝업 텍스트)
            popup: false,         // 팝업 없이 백그라운드에서 인식
            partialResults: true, // 말하는 도중에도 결과 받기
        });

    } catch (error) {
        console.error('STT Start Error:', error);
        if (onEnd) onEnd();
    }
};

// 듣기 중단 함수
export const stopListening = async () => {
    try {
        await SpeechRecognition.stop();
        await SpeechRecognition.removeAllListeners();
    } catch (error) {
        // 에러 로그는 남기되, 앱이 멈추지 않도록 처리
        console.warn('STT Stop Warning:', error);
    }
};
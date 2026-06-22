# WalkMate User UI

WalkMate `userUI`는 시각장애인 보행 보조를 위한 사용자 앱입니다. React + Vite로 화면을 만들고, Capacitor로 iOS WebView 앱에서 실행합니다. 앱은 위치 기반 길안내, 음성 입력/출력, 카메라 기반 객체탐지, 위험 신고 업로드를 한 흐름으로 연결합니다.

## 주요 기능

- 현재 위치 확인
- 목적지 음성 입력
- TMAP POI 기반 목적지 검색
- 백엔드 경로 API 호출
- 지도 기반 경로 표시
- TTS 기반 보행 안내
- 카메라 프레임 기반 TFLite 객체탐지
- 위험 객체 감지 시 이미지와 위치를 백엔드로 신고

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| UI | React 19, Vite |
| 모바일 런타임 | Capacitor iOS |
| 위치 | `@capacitor/geolocation` |
| 음성 인식 | `@capacitor-community/speech-recognition` |
| 음성 출력 | `@capacitor-community/text-to-speech` |
| 지도 | Leaflet, React Leaflet |
| 카메라 | React Webcam |
| AI 추론 | TensorFlow.js, `@tensorflow/tfjs-tflite` |
| 스타일 | Tailwind CDN, Material Icons |

## 주요 파일 구조

```text
UI/userUI/
├── App.tsx
├── index.tsx
├── index.html
├── types.ts
├── components/
│   ├── IdleScreen.tsx
│   ├── ListeningScreen.tsx
│   ├── RetryScreen.tsx
│   ├── ConfirmationScreen.tsx
│   ├── GuidingScreen.tsx
│   ├── DebugMap.tsx
│   └── VisionCamera.tsx
├── src/
│   ├── api/
│   │   ├── backend.ts
│   │   ├── report.ts
│   │   └── tmap.ts
│   └── utils/
│       ├── audio.ts
│       ├── josa.ts
│       └── YoloParser.ts
├── public/wasm/
│   ├── best_float32.tflite
│   └── tflite_web_api_*.js, *.wasm, *.worker.js
└── ios/App/
```

## 환경 변수

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cd UI/userUI
cp .env.example .env
```

필요한 값:

```text
VITE_BACKEND_URL=http://localhost:8000
VITE_TMAP_API_KEY=[YOUR_TMAP_API_KEY_HERE]
```

실기기 iPhone에서 테스트할 때 `localhost`는 iPhone 자신을 가리키므로, Mac에서 실행 중인 백엔드에 접근하려면 같은 Wi-Fi의 Mac IP를 넣어야 합니다.

```text
VITE_BACKEND_URL=http://<MAC_LOCAL_IP>:8000
```

예:

```text
VITE_BACKEND_URL=http://172.30.1.80:8000
```

## 로컬 웹 실행

```bash
cd UI/userUI
npm install
npm run dev -- --host 0.0.0.0
```

브라우저에서 열기:

```text
http://localhost:5173
```

같은 네트워크의 다른 기기에서 접근하려면:

```text
http://<MAC_LOCAL_IP>:5173
```

주의: 웹 브라우저 환경에서는 native STT/TTS/위치/카메라 동작이 iOS 앱과 다르게 동작할 수 있습니다. 특히 `src/utils/audio.ts`의 웹 fallback은 음성 인식 대신 테스트용으로 `"수원역"`을 반환합니다.

## iOS 앱 실행

웹 코드를 iOS 앱에 반영하려면 매번 build 후 Capacitor copy가 필요합니다.

```bash
cd UI/userUI
npm run build
npx cap copy ios
npx cap open ios
```

Xcode가 열리면 실제 iPhone을 선택하고 Run을 실행합니다.

Pods 문제가 있으면 다음을 실행합니다.

```bash
cd UI/userUI/ios/App
pod install
```

## 앱 흐름

```text
IDLE
  -> 현재 위치 확인
  -> LISTENING
  -> 목적지 음성 입력
  -> TMAP POI 검색
  -> CONFIRMATION
  -> 목적지 확인
  -> 백엔드 경로 요청
  -> GUIDING
  -> 지도 안내 + 카메라 객체탐지 + 위험 신고
```

화면 상태는 `types.ts`의 `AppScreen`으로 정의되어 있습니다.

## 객체탐지 모델

현재 앱은 다음 모델을 로드합니다.

```text
public/wasm/best_float32.tflite
```

관련 코드:

```text
components/VisionCamera.tsx
src/utils/YoloParser.ts
```

모델 파일을 바꾼 뒤 iOS에서 테스트하려면 다음 순서가 필요합니다.

```bash
cd UI/userUI
npm run build
npx cap copy ios
```

현재 TFLite 런타임 파일도 `public/wasm/` 아래에서 함께 제공됩니다.

## 백엔드 연동

경로 안내 API:

```text
POST {VITE_BACKEND_URL}/api/v1/navigation/path/
```

위험 신고 API:

```text
POST {VITE_BACKEND_URL}/api/v1/reports/
```

신고 전송은 `src/api/report.ts`에서 처리합니다. 카메라 이미지 Base64를 JPEG Blob으로 바꾸고, 위치/위험도/라벨/설명과 함께 `FormData`로 업로드합니다.

## iOS 권한

iOS 테스트 시 다음 권한이 필요합니다.

- 위치
- 카메라
- 마이크
- 음성 인식
- 모션/방향 센서
- 로컬 네트워크

권한 문구는 `ios/App/App/Info.plist`에 정의되어 있습니다.

## 자주 발생하는 문제

### GPS timeout

로그에 다음과 비슷한 문구가 나올 수 있습니다.

```text
Could not obtain location in time
```

실내, 건물 사이, 네트워크 불안정 환경에서 GPS 응답이 늦으면 발생합니다. 현재 코드는 timeout을 늘리고, 위치 확보 실패 시 앱 전체를 중단하지 않도록 완충 처리합니다. 다만 실외 이동 테스트에서는 GPS 수신 상태를 계속 확인해야 합니다.

### 객체탐지가 느림

현재 구조는 iOS WebView 안에서 `tfjs-tflite` WebAssembly 추론을 수행합니다. 기기 성능, 발열, 카메라 프레임, WebView 상태에 따라 추론 시간이 길어질 수 있습니다.

### 모델 로드 실패

다음 파일들이 `public/wasm/`와 iOS public에 있어야 합니다.

```text
best_float32.tflite
tflite_web_api_client.js
tflite_web_api_cc*.js
tflite_web_api_cc*.wasm
*.worker.js
```

iOS public에 반영하려면 `npm run build && npx cap copy ios`를 다시 실행합니다.

### 백엔드 연결 실패

iPhone 실기기에서는 `.env`의 `VITE_BACKEND_URL`이 `localhost`이면 안 됩니다. Mac의 실제 로컬 IP와 백엔드 포트를 넣어야 합니다.

### 지도 또는 아이콘이 보이지 않음

현재 `index.html`은 Tailwind CDN, Google Fonts, Material Icons, OpenStreetMap tile 등 외부 네트워크에 의존합니다. 네트워크가 막히면 일부 스타일, 아이콘, 지도 배경이 보이지 않을 수 있습니다.

## 빌드 확인

```bash
cd UI/userUI
npm run build
```

현재 빌드에서는 `@tensorflow/tfjs-tflite`의 eval 사용 경고와 큰 번들 경고가 나올 수 있습니다. 이는 현재 의존성과 번들 크기에서 발생하는 경고이며, 빌드 실패는 아닙니다.

# WalkMate - 시각장애인을 위한 AI 보행 안내 시스템

> 컴퓨터 비전(YOLO11)과 TMAP 보행자 경로 API를 결합한 시각장애인 보행 안내 모바일 앱

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [팀 구성 및 역할](#팀-구성-및-역할)
3. [전체 아키텍처](#전체-아키텍처)
4. [주요 기능](#주요-기능)
5. [기술 스택](#기술-스택)
6. [프로젝트 구조](#프로젝트-구조)
7. [각 파트 상세 설명](#각-파트-상세-설명)
   - [사용자 앱 (UserUI)](#사용자-앱-userui)
   - [관리자 대시보드 (AdminUI)](#관리자-대시보드-adminui)
   - [Flutter 앱 ](#flutter-앱)
   - [AI 모델 학습 ](#ai-모델-학습)
8. [API 연동](#api-연동)
9. [설치 및 실행 방법](#설치-및-실행-방법)
10. [화면 흐름](#화면-흐름)

---

## 프로젝트 개요

**WalkMate**는 시각장애인이 도심 보행 시 필요한 두 가지 핵심 정보를 음성으로 안내해주는 모바일 애플리케이션입니다.

1. **경로 안내**: TMAP 보행자 API를 통해 목적지까지의 도보 경로를 시계 방향(12시 = 정면)으로 안내
2. **장애물 감지**: YOLO11 기반 AI 모델이 실시간 카메라 영상에서 점자 블록 파손 여부 및 기타 장애물을 감지하고 음성으로 경고

사용자는 음성 명령으로 앱 전체를 제어할 수 있어, 화면을 직접 보지 않아도 안전하게 보행할 수 있습니다.

---

## 팀 구성 및 역할

| 이름       | 역할                                     | 담당 디렉토리   |
| ---------- | ---------------------------------------- | --------------- |
| **윤지현** | 프론트엔드 (모바일 앱 + 관리자 대시보드) | `yoonjihyun/`   |
| **이지호** | Flutter 모바일 앱 개발                   | `leejiho/`      |
| **최현석** | AI/ML (YOLO11 모델 학습 및 추론)         | `choihyunseok/` |

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  사용자 스마트폰                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │         Capacitor (Web → Native 브릿지)       │   │
│  │  ┌─────────────────┐  ┌────────────────────┐ │   │
│  │  │   React + TS    │  │  Android Native     │ │   │
│  │  │  (UI 화면들)     │  │  NpuTflitePlugin    │ │   │
│  │  └────────┬────────┘  └────────┬───────────┘ │   │
│  │           │                    │              │   │
│  │  ┌────────▼────────────────────▼───────────┐ │   │
│  │  │      Capacitor Core / Plugins            │ │   │
│  │  │  - Geolocation (GPS)                     │ │   │
│  │  │  - TextToSpeech (TTS)                    │ │   │
│  │  │  - SpeechRecognition (STT)               │ │   │
│  │  │  - CapacitorHttp (TMAP API 호출)          │ │   │
│  │  └─────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│                         │                           │
│     카메라 → TFLite 모델 추론 (YOLO11)               │
│     GPS → TMAP API → 경로 안내 음성                  │
└─────────────────────────────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │    TMAP REST API     │
               │  (SK OpenAPI)        │
               │  보행자 경로 탐색     │
               └─────────────────────┘
```

**AI 파이프라인:**

```
카메라 프레임 → Base64 인코딩 → NpuTflitePlugin(Java) → TFLite 모델
→ 감지 결과 (바운딩박스 + 클래스 + 신뢰도) → Canvas 오버레이 + TTS 경고
```

---

## 주요 기능

### 사용자 앱

- **완전 음성 제어**: 목적지 입력부터 경로 종료까지 모든 조작을 음성으로 수행 (한국어 STT/TTS)
- **실시간 경로 안내**: GPS로 현재 위치를 추적하고, 다음 경유지까지의 방향을 시계 방향(예: "2시 방향으로 이동")으로 안내
- **점자 블록 감지**: 카메라를 통해 실시간으로 점자 블록 상태 감지
  - 정상 유도 블록 (직선 보행)
  - 정상 멈춤 블록 (방향 전환/주의)
  - 파손된 유도 블록 (경고)
  - 파손된 멈춤 블록 (경고)
- **디버그 지도**: Leaflet 기반 지도로 현재 위치 및 경로 시각화 (개발/테스트용)

### 관리자 대시보드

- 현장에서 수집된 위험 지점 데이터 관리
- 위험도(High/Medium/Low) 및 처리 상태(Pending/In Progress/Resolved) 관리
- B2B(기업), B2G(정부) 리포트 구분 관리
- 위치 좌표, 센서 데이터(자이로/가속도계), 사진 썸네일 포함

---

## 기술 스택

### 프론트엔드 (사용자 앱 - `yoonjihyun/UI/userUI/`)

| 기술                  | 버전           | 용도               |
| --------------------- | -------------- | ------------------ |
| React                 | 19.2.4         | UI 컴포넌트        |
| TypeScript            | 5.8.2          | 정적 타입          |
| Capacitor             | 8.0.2          | 웹→네이티브 브릿지 |
| Vite                  | 6.2.0          | 빌드 도구          |
| TensorFlow.js         | 4.22.0         | ML 프레임워크      |
| TFLite                | 0.0.1-alpha.10 | 모델 추론          |
| React-Leaflet         | 5.0.0          | 지도 시각화        |
| Capacitor Geolocation | 8.1.0          | GPS                |
| Capacitor TTS         | 8.0.0          | 음성 출력          |
| Capacitor STT         | 7.0.1          | 음성 인식          |

### 프론트엔드 (관리자 대시보드 - `yoonjihyun/UI/adminUI/`)

| 기술         | 버전    | 용도          |
| ------------ | ------- | ------------- |
| React        | 19.2.4  | UI            |
| Recharts     | 3.7.0   | 데이터 시각화 |
| Lucide React | 0.563.0 | 아이콘        |

### 모바일 네이티브 (Android)

| 기술                     | 용도                          |
| ------------------------ | ----------------------------- |
| Java                     | NpuTflitePlugin (TFLite 추론) |
| TensorFlow Lite          | AI 모델 실행 (NPU/GPU/CPU)    |
| Capacitor BridgeActivity | Android 진입점                |

### Flutter 앱 (`leejiho/flutter/`)

| 기술           | 버전  | 용도            |
| -------------- | ----- | --------------- |
| Flutter        | 3.x   | 크로스플랫폼 UI |
| flutter_vision | 1.1.4 | 카메라 + 비전   |
| TFLite         | -     | 모델 추론       |

### AI/ML (`choihyunseok/`)

| 기술            | 용도                     |
| --------------- | ------------------------ |
| YOLO11n-seg     | 객체 탐지 + 세그멘테이션 |
| Ultralytics     | YOLO 학습 프레임워크     |
| OpenCV          | 영상 처리                |
| TensorFlow Lite | 모바일 추론용 변환       |

---

## 프로젝트 구조

```
cvProjectTeam3/
│
├── README.MD                          # 이 파일
│
├── choihyunseok/                      # AI 모델 파트
│   ├── train.py                       # YOLO11 모델 학습 스크립트
│   ├── test.py                        # 웹캠 실시간 추론 테스트
│   └── runs/segment/                  # 학습 결과물 (weights 등)
│
├── leejiho/                           # Flutter 앱 파트
│   └── flutter/
│       ├── lib/                       # Dart 소스코드
│       ├── assets/
│       │   ├── best_float32.tflite    # 변환된 TFLite 모델
│       │   └── labels.txt             # 클래스 레이블
│       └── pubspec.yaml               # Flutter 의존성
│
└── yoonjihyun/                        # 프론트엔드 파트
    ├── dataset/                       # 모델 학습용 데이터셋
    └── UI/
        ├── userUI/                    # 사용자 모바일 앱 (주력)
        │   ├── components/
        │   │   ├── IdleScreen.tsx          # 대기 화면
        │   │   ├── ListeningScreen.tsx     # 음성 인식 화면
        │   │   ├── ConfirmationScreen.tsx  # 목적지 확인 화면
        │   │   ├── GuidingScreen.tsx       # 경로 안내 화면 (핵심)
        │   │   ├── VisionCamera.tsx        # AI 카메라 화면
        │   │   ├── RetryScreen.tsx         # 재시도 화면
        │   │   └── DebugMap.tsx            # 디버그 지도
        │   ├── src/
        │   │   ├── api/tmap.ts             # TMAP API 연동
        │   │   └── utils/audio.ts          # TTS/STT 유틸리티
        │   ├── android/                    # Android 네이티브
        │   │   └── app/src/main/java/com/team3/walkmate/
        │   │       ├── MainActivity.java        # 앱 진입점
        │   │       └── NpuTflitePlugin.java     # TFLite 플러그인
        │   ├── NpuTfliteBridge.ts          # 플러그인 TS 인터페이스
        │   ├── App.tsx                     # 앱 라우터
        │   ├── capacitor.config.ts         # Capacitor 설정
        │   └── package.json
        │
        └── adminUI/                   # 관리자 웹 대시보드
            ├── components/
            │   ├── Sidebar.tsx             # 사이드 네비게이션
            │   ├── HazardTable.tsx         # 위험 지점 테이블
            │   └── HazardModal.tsx         # 상세 정보 모달
            ├── views/
            │   ├── Dashboard.tsx           # 메인 대시보드
            │   ├── Database.tsx            # 데이터 관리
            │   ├── Reports.tsx             # 리포트 (B2B/B2G)
            │   └── Settings.tsx            # 설정
            └── package.json
```

---

## 각 파트 상세 설명

### 사용자 앱 (UserUI)

**앱 ID:** `com.walkmate.app`  
**경로:** `yoonjihyun/UI/userUI/`

#### 핵심 컴포넌트

##### GuidingScreen.tsx — 경로 안내 (핵심 화면)

경로 안내의 전체 로직을 담당합니다.

1. **GPS 정확도 확보**: GPS 정확도가 20m 이내가 될 때까지 대기 (최대 30초)
2. **초기 방향 확립**: 처음 5걸음 동안 이동 방향을 계산하여 기기 방향 기준점 설정
3. **TMAP 경로 요청**: 현재 GPS 좌표 → 목적지 좌표로 보행자 경로 API 호출
4. **경유지 안내**: 경로의 각 포인트를 순서대로 따라가며 음성 안내
   - 방향 표시 방식: 시계 방향 (12시 = 정면, 3시 = 우측, 9시 = 좌측)
   - 다음 경유지까지의 각도를 계산하여 "2시 방향으로 이동하세요" 형태로 안내
5. **경유지 도달 판정**: 현재 위치와 경유지 간 거리가 15m 이내 → 다음 경유지로 전환
6. **음성 종료 명령**: 안내 중 "종료", "그만", "스탑" 발화 시 탐색 종료

##### VisionCamera.tsx — AI 객체 감지

```
카메라 → 이미지 캡처(1초 간격) → Base64 인코딩
→ NpuTflitePlugin.detect() → TFLite 추론
→ 바운딩박스 Canvas 렌더링 + TTS 경고(3초 쿨다운)
```

감지 클래스:

- `Stop block broken` → "파손된 정지 블록이 감지되었습니다" (위험 경고)
- `Stop block normal` → "정지 블록"
- `Straight block broken` → "파손된 직선 블록이 감지되었습니다" (위험 경고)
- `Straight block normal` → "직선 유도 블록"

##### NpuTflitePlugin — 하드웨어 가속 추론

Java로 작성된 Capacitor 커스텀 플러그인으로, 디바이스 하드웨어를 활용한 TFLite 추론을 수행합니다.

```
loadModel() → NPU 위임 시도 → 실패 시 GPU → 실패 시 CPU 폴백
detect(base64Image) → float32 텐서 배열 반환 (바운딩박스 + 클래스 + 신뢰도)
```

---

### 관리자 대시보드 (AdminUI)

**경로:** `yoonjihyun/UI/adminUI/`

현장 수집 위험 지점 데이터를 관리하는 웹 애플리케이션입니다.

**위험 지점 데이터 구조:**

```typescript
{
  id: string;
  thumbnail: string; // 현장 사진
  riskLevel: "High" | "Medium" | "Low";
  type: string; // 포트홀, 불균형 보도 등
  location: string; // 주소
  coordinates: string; // 위경도
  timestamp: string;
  status: "Pending" | "In Progress" | "Resolved";
  reportType: "B2B" | "B2G"; // 기업/정부 리포트 구분
  description: string;
  reporter: string;
  sensorData: {
    gyro: string; // 자이로스코프 데이터
    accel: string; // 가속도계 데이터
  }
}
```

---

### Flutter 앱 (leejiho)

**경로:** `leejiho/flutter/`

Capacitor 앱과 동일한 YOLO11 TFLite 모델을 사용하는 Flutter 기반 대안 구현입니다.

- `flutter_vision` 패키지로 카메라 영상 처리
- `assets/best_float32.tflite`: 학습된 YOLO11 모델 (float32 양자화)
- `assets/labels.txt`: 점자 블록 클래스 레이블

---

### AI 모델 학습 (choihyunseok)

**경로:** `choihyunseok/`

#### 모델: YOLO11n-seg (Nano Segmentation)

**학습 목표:** 보도의 점자 블록(유도 블록, 멈춤 블록) 정상/파손 상태 4-class 감지

**학습 설정:**

```python
model = YOLO('yolo11n-seg.pt')   # 사전 학습 가중치로 전이 학습
model.train(
    data='custom_data.yaml',      # 커스텀 데이터셋
    epochs=100,
    batch=16,
    imgsz=640,
)
```

**감지 클래스:**

1. `Stop block broken` - 파손된 멈춤 블록
2. `Stop block normal` - 정상 멈춤 블록
3. `Straight block broken` - 파손된 유도 블록
4. `Straight block normal` - 정상 유도 블록

**모바일 배포:**

- 학습 완료 후 `.pt` → `.tflite` (float32) 변환
- Capacitor 앱과 Flutter 앱에서 공통으로 사용

---

## API 연동

### TMAP 보행자 경로 API

**제공사:** SK Telecom (SK OpenAPI)  
**엔드포인트:** `https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json`  
**호출 방식:** Capacitor CapacitorHttp (네이티브 레이어 → CORS 우회)

**요청 파라미터:**

```json
{
  "startX": "경도 (출발지)",
  "startY": "위도 (출발지)",
  "endX": "경도 (목적지)",
  "endY": "위도 (목적지)",
  "reqCoordType": "WGS84GEO",
  "resCoordType": "WGS84GEO",
  "searchOption": "0"
}
```

**응답:** GeoJSON 형태의 경유지 포인트 + 경로 LineString + 각 구간 안내 메시지

---

## 설치 및 실행 방법

### 사전 요구사항

- Node.js 18+
- Android Studio (Android 빌드용)
- Java 17
- Android SDK API 34+

### 사용자 앱 (UserUI)

```bash
# 1. 의존성 설치
cd yoonjihyun/UI/userUI
npm install

# 2. 웹 빌드
npm run build

# 3. Android 동기화
npx cap sync android

# 4. Android Studio에서 열기
npx cap open android

# 5. Android Studio에서 디바이스/에뮬레이터로 빌드 & 실행
```

### 관리자 대시보드 (AdminUI)

```bash
cd yoonjihyun/UI/adminUI
npm install
npm run dev          # 개발 서버 실행 (localhost:5173)
```

### Flutter 앱

```bash
cd leejiho/flutter
flutter pub get
flutter run
```

### AI 모델 학습

```bash
cd choihyunseok
pip install ultralytics opencv-python
python train.py      # 모델 학습
python test.py       # 웹캠 추론 테스트
```

---

## 화면 흐름

```
앱 실행
  │
  ▼
[IdleScreen] ─ "안내 시작" 음성 발화 ──────────────────────┐
  │                                                        │
  ▼                                                        │
[ListeningScreen] ─ 음성 인식 중 (한국어 STT)              │
  │                                                        │
  ▼                                                        │
[ConfirmationScreen] ─ "○○이 맞으신가요?"                  │
  │ "응" / "네"                                            │
  ▼                                                        │
[GuidingScreen] ─ 경로 안내 + AI 카메라 동시 실행          │
  │  "종료" / "그만" / "스탑"                              │
  └────────────────────────────────────────────────────────┘
```

**GuidingScreen 내부 상태 흐름:**

```
GPS 정확도 확보 중 (최대 30초)
  → TMAP API 경로 요청
  → 초기 방향 확립 (5보 이동)
  → 경유지 순차 안내 (시계 방향)
  → 목적지 도달 → "목적지에 도착했습니다"
```

---

## Android 권한

앱이 정상 동작하기 위해 아래 권한들이 필요합니다:

| 권한                     | 용도               |
| ------------------------ | ------------------ |
| `ACCESS_FINE_LOCATION`   | GPS 정밀 위치      |
| `ACCESS_COARSE_LOCATION` | 네트워크 기반 위치 |
| `RECORD_AUDIO`           | 음성 인식 (STT)    |
| `CAMERA`                 | 점자 블록 감지     |
| `INTERNET`               | TMAP API 호출      |

---

## 주의 사항

- 본 앱은 **Android 전용**으로 빌드되어 있습니다 (Capacitor Android 구성 완료).
- GPS 신호가 약한 실내 환경에서는 경로 안내 정확도가 낮아질 수 있습니다.
- TFLite 추론 성능은 디바이스 NPU/GPU 지원 여부에 따라 달라집니다.
- TMAP API는 한국 내 위치에서만 정상 동작합니다.

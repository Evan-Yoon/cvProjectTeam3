# WalkMate - 시각장애인을 위한 AI 보행 안내 시스템

> 컴퓨터 비전(TensorFlow Lite)과 TMAP 보행자 경로 API를 결합한 시각장애인 보행 안내 모바일 앱 및 관리 대시보드 시스템

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [주요 기능](#주요-기능)
4. [기술 스택](#기술-스택)
5. [프로젝트 구조](#프로젝트-구조)
6. [각 파트 상세 설명](#각-파트-상세-설명)
   - [사용자 앱 (UserUI)](#사용자-앱-userui)
   - [관리자 대시보드 (AdminUI)](#관리자-대시보드-adminui)
   - [백엔드 서버 (backend)](#백엔드-서버-backend)
7. [API 연동](#api-연동)
8. [설치 및 실행 방법](#설치-및-실행-방법)
9. [화면 흐름](#화면-흐름)
10. [Android 권한 및 주의 사항](#android-권한-및-주의-사항)

---

## 프로젝트 개요

**WalkMate**는 시각장애인이 도심 보행 시 필요한 두 가지 핵심 정보를 음성으로 안내해주는 모바일 애플리케이션 및 모니터링 시스템입니다.

1. **경로 안내**: TMAP 보행자 API를 통해 목적지까지의 도보 경로를 시계 방향(12시 = 정면)으로 안내합니다.
2. **장애물 감지**: 온디바이스 TFLite 기반 AI 모델이 실시간 카메라 영상에서 점자 블록 상태(정상/파손)를 감지하여 음성으로 주의 경고를 전달합니다.

사용자는 음성 명령으로 앱 전체를 제어할 수 있어, 화면을 직접 보지 않아도 안전하게 보행할 수 있습니다.

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  사용자 스마트폰 (Capacitor)        │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
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
│  │  └─────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│                         │                           │
│     카메라 ➔ TFLite 모델 추론 (YOLO)                │
│     GPS ➔ 백엔드 통신 ➔ 경로 정보 획득              │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP Request (CORS 우회)
                          ▼
                ┌──────────────────┐      ┌───────────────┐
                │   FastAPI 서버   ├─────➔│ TMAP REST API │
                │   (backend)      │      │ (경로 탐색)   │
                └────┬─────────┬───┘      └───────────────┘
                     │         │
          PostgreSQL │         │ S3 Upload
          (PostGIS)  ▼         ▼
                ┌────────┐  ┌────────┐
                │   DB   │  │ AWS S3 │
                │ (Data) │  │(Images)│
                └────────┘  └────────┘
```

**AI 추론 파이프라인:**
```
카메라 프레임 ➔ Canvas Letterbox 전처리 ➔ Base64 인코딩 ➔ NpuTflitePlugin(Java) 
➔ TFLite 모델 추론 (best_float32.tflite) ➔ 감지 결과 (Box/Class/Score) ➔ TTS 경고 및 백엔드 위험 신고
```

---

## 주요 기능

### 사용자 앱
- **음성 제어**: 목적지 입력부터 안내 종료까지 음성 인식 기반(STT/TTS) 제어를 지원합니다.
- **실시간 보행 경로 안내**: GPS 신호를 모니터링하여 경유지마다 진행각도를 Haversine 공식 및 시계 방향 방위(예: "2시 방향으로 이동")로 직관적으로 알려줍니다.
- **점자 블록 실시간 감지**: 카메라 프레임 분석을 통해 정상/파손된 점자 블록을 구분하여 즉각 경고음을 제공합니다.

### 관리자 대시보드
- **위험 리포트 시각화**: 접수된 위험 신고 데이터를 수치 통계 대시보드 및 지도의 Heatmap(Leaflet)으로 시각화합니다.
- **위험 지점 관리**: 접수된 신고의 처리 상태 변경(`new`, `processing`, `done`), 상세 모달 확인, CSV 데이터 내보내기 등을 지원합니다.

### 백엔드 서버
- **신고 접수 API**: 사용자 앱에서 전송된 위험 요인 위치 데이터와 현장 캡처 이미지를 접수하여 이미지 파일은 S3에 저장하고 위경도 좌표는 PostGIS Point 객체로 환산하여 DB에 입력합니다.
- **경로 최적화 중계 API**: TMAP 보행자 API 통신을 대행하여 프론트엔드가 다루기 편리한 구조화된 단계별 경로 좌표 배열과 메시지 셋으로 가공해 반환합니다.

---

## 기술 스택

### 프론트엔드
- **사용자 앱 (`UI/userUI/`)**: React (v19), TypeScript, Capacitor Android, React-Leaflet, Capacitor Geolocation/TTS/STT
- **관리자 앱 (`UI/adminUI/`)**: React (v19), Recharts, Leaflet, Tailwind CSS

### 백엔드 (`backend/`)
- **FastAPI**: REST API 처리
- **SQLAlchemy & psycopg2-binary**: PostgreSQL/PostGIS 데이터베이스 통신
- **boto3**: AWS S3 사진 아티팩트 업로드 처리
- **Pydantic & Python-dotenv**: 스키마 유효성 검증 및 환경 설정 로드

### 인프라 및 AI
- **데이터베이스**: PostgreSQL 15 + PostGIS Extension
- **온디바이스 AI**: TensorFlow Lite Interpreter (NpuTflitePlugin.java)

---

## 프로젝트 구조

```
cvProjectTeam3/
│
├── .devcontainer/                      # Docker Compose 기반의 개발 컨테이너 설정
│   ├── Dockerfile
│   └── docker-compose.yml              # Python, PostGIS, Redis 스택
│
├── .env.example                        # 환경변수 통합 설정 템플릿
│
├── UI/                                 # 프론트엔드 폴더
│   ├── userUI/                         # 시각장애인 안내 모바일 앱
│   │   ├── src/api/tmap.ts             # TMAP 장소 검색 및 역지오코딩
│   │   ├── components/                 # Idle/Listening/Guiding/VisionCamera 화면
│   │   ├── android/                    # Capacitor 빌드로 연동된 안드로이드 네이티브
│   │   └── .env.example
│   │
│   └── adminUI/                        # 대시보드 관제 앱
│       ├── views/                      # Dashboard / Heatmap / Database 뷰
│       └── .env.example
│
├── backend/                            # FastAPI 백엔드 폴더
│   ├── app/
│   │   ├── api/v1/endpoints/           # reports / admin / navigation 엔드포인트
│   │   ├── core/                       # config.py (환경변수) / database.py
│   │   ├── crud/                       # SQLAlchemy 기반의 PostGIS 공간 쿼리 처리
│   │   └── services/s3_uploader.py     # S3 이미지 업로드 유틸리티
│   ├── run.py                          # Uvicorn 서버 기동 진입점
│   ├── requirements.txt                # 파이썬 라이브러리 목록
│   └── .env.example
│
└── model/                              # 비전 관련 아티팩트 및 추론 예시 스크립트
    ├── best_float32.tflite             # 온디바이스 탑재 모델
    ├── road.jpg                        # 테스트 이미지
    └── new2.py                         # 간단 이미지 추론 테스트 스크립트
```

---

## 각 파트 상세 설명

### 사용자 앱 (UserUI)
- **GuidingScreen.tsx (안내 구현)**: Geolocation 감시를 실행하여 Haversine 거리 계산을 통해 경유지 도달 여부 및 이탈 시 방향 이탈 보정 안내를 처리합니다.
- **VisionCamera.tsx (온디바이스 비전)**: 카메라 영상 스트림에서 3초마다 base64 이미지를 캡처하여 네이티브 플러그인에 전송합니다.
- **NpuTflitePlugin.java**: Android 네이티브 백그라운드 스레드 상에서 TFLite 인터프리터를 기동하여 CPU 4 thread 환경으로 탐지 모델을 실행합니다.

### 관리자 대시보드 (AdminUI)
- Supabase 실시간 구독 및 백엔드 REST API를 사용하여 동적으로 신고 데이터를 반영합니다. Leaflet Map 위에서 필터를 걸어 위험도별 지역 상황을 점검할 수 있습니다.

### 백엔드 서버 (backend)
- `/api/v1/reports/` (POST)를 통해 멀티파트 폼 형태로 접수받아 S3 URL을 획득하고, 위도 경도 데이터를 공간 쿼리 `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` 형식으로 SQL에 바인딩하여 안전하게 PostGIS 인덱싱을 거쳐 저장합니다.

---

## API 연동

### TMAP 보행자 경로 API
- **엔드포인트**: `https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json`
- **호출 우회**: CORS 이슈 및 네트워크 안정성을 위해 프론트엔드의 `CapacitorHttp` 및 백엔드의 중계 REST 요청을 병행 구성합니다.

---

## 설치 및 실행 방법

### 0. 개발 컨테이너 환경에서 실행 (Dev Containers)

이 프로젝트는 Docker 기반 개발 환경([.devcontainer](file:///Users/company/Desktop/cvProjectTeam3/.devcontainer))을 제공하므로, 로컬 환경 오염 없이 즉시 전체 스택(파이썬, Node, Java, PostGIS DB, Redis)을 일관되게 실행할 수 있습니다.

#### VS Code Dev Containers 활용법
1. **Docker Desktop** 실행
2. VS Code에서 `Dev Containers` 확장을 설치한 후, 본 프로젝트 폴더를 열고 알림 창의 **`Reopen in Container`** 또는 명령 팔레트(`Cmd/Ctrl + Shift + P`)의 **`Dev Containers: Reopen in Container`** 선택
3. 개발 가상환경과 백엔드 DB/Redis가 자동으로 기동됩니다.

#### 로컬 Docker Compose로 직접 인프라만 띄울 때
컨테이너 내부가 아닌 로컬에서 개발을 진행하되, 데이터베이스(PostgreSQL/PostGIS) 및 Redis 인프라만 도커로 띄우고 싶을 때 실행합니다.
```bash
cd .devcontainer
docker compose up -d
```

### 1. 사용자 앱 (UI/userUI)
```bash
cd UI/userUI
npm install
npm run build
npx cap sync android
npx cap open android # Android Studio에서 실행 및 기기 빌드
```

### 2. 관리자 대시보드 (UI/adminUI)
```bash
cd UI/adminUI
npm install
npm run dev
```

### 3. 백엔드 서버 (backend)
```bash
cd backend
pip install -r requirements.txt
python run.py
```

---

## 화면 흐름

```
앱 실행 ➔ [IdleScreen] (안내 대기 및 음성 안내)
          │
          ▼ (사용자 "안내 시작" 발화)
       [ListeningScreen] (목적지 한국어 STT 입력)
          │
          ▼ (장소 검색 성공 시)
       [ConfirmationScreen] ("○○이 맞으신가요?" 확인)
          │
          ▼ (사용자 "응"/"네" 확인 응답)
       [GuidingScreen] + [VisionCamera] (GPS 경로 탐색 및 카메라 실시간 장애물 위험 탐지 동시 구동)
          │
          ▼ (사용자 "종료" 명령 또는 목적지 최종 도착)
       안내 해제 및 대기 화면 복귀
```

---

## Android 권한 및 주의 사항

### 요구 권한
- `ACCESS_FINE_LOCATION` (GPS 정밀 위치 추적용)
- `ACCESS_COARSE_LOCATION` (기지국/Wi-Fi 기반 위치용)
- `RECORD_AUDIO` (STT 목적지 음성 명령 입력용)
- `CAMERA` (점자 블록 영상 실시간 촬영 및 수집용)
- `INTERNET` (TMAP 경로 연동 및 위험 요소 백엔드 전송용)

### 주의 사항
- 본 시스템의 최적 성능(TFLite 실시간 추론 속도 및 GPS 각도 보정)은 가속 하드웨어가 지원되는 안드로이드 실기기 환경을 권장합니다.
- TMAP API 키 및 데이터베이스 정보 등의 세부 크리덴셜은 로컬 디바이스의 `.env` 환경 설정에 맞춰 구성해야 합니다.

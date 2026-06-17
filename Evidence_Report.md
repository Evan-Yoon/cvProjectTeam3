# Evidence Report

감사 기준일: 2026-06-17

이 문서는 현재 레포에 존재하는 코드, 설정 파일, 실행 파일, 테스트/로그성 파일, README만 근거로 작성했습니다. 현재 파일시스템에 존재하지 않는 경로는 구현 근거에서 제외했습니다.

## 1. 레포 구조 요약

### 주요 폴더

| 경로 | 확인된 역할 |
|---|---|
| `UI/userUI` | 사용자용 React + Vite + Capacitor 앱 |
| `UI/adminUI` | 관리자용 React + Vite 대시보드 |
| `backend` | FastAPI 백엔드 |
| `model` | YOLO 추론 테스트용 이미지/모델/스크립트 |

### Frontend 관련 폴더

- 사용자 앱 화면 상태를 React state로 전환했습니다.
    - `UI/userUI/App.tsx`: 화면 상태를 string이 아닌 enum 형식을 활용하여 오타 방지
    - `UI/userUI/types.ts`: interface와 enum을 따로 관리하여 코드 재사용성 및 가독성 높임

- 사용자 앱은 Capacitor 기반 GPS, STT, TTS, Android TFLite 플러그인, React Webcam, Leaflet 지도 기능을 포함했습니다.
    - `UI/userUI/components/VisionCamera.tsx`: 
        - **React Webcam**: useState가 아닌 `useRef`로 웹캠 인스턴스에 직접 접근하여 불필요한 재렌더링 방지
        - **캡처 전처리**: Canvas API를 활용해 원본 비율을 유지하는 640x640 입력의 YOLO 모델 규격맞추기 위한 Letterbox 전처리
        - **비동기 제어**: `isRunningRef`라는 실행 플래그를 관리하여 인터넷 속도에 따라 짧은 주기의 비동기 추론 루프가 쌓이는 현상 방지
        - **메모리 누수 방지**: VisionCamera 컴포넌트 언마운트 시 `isMounted` 플래그를 해제하고 `clearInterval`을 호출하여 비동기 자원을 정리하여 메모리 누수 방지

    - `UI/userUI/components/GuidingScreen.tsx`: 
        - **지도 시각화**: Leaflet 라이브러리를 통해 목적지 경로선(Path), 사용자 위치(Marker), 시선 방향(Arrow)을 실시간 맵 매핑
        - **실시간 위치 추적 및 단계 자동 전환**: `watchPosition`으로 실시간 좌표를 감시하고, Haversine 공식 기반으로 남은 거리를 계산하며 오차 범위를 고려해 체크포인트 도달 시 다음 경로 자동 전환(Bypass) 처리
        - **센서 퓨전(Sensor Fusion) 방향 보정**: 자이로스코프/나침반 센서값의 미세한 흔들림 및 왜곡을 사용자의 GPS 이동 궤적(방위각) 데이터와 결합하여 진행 방향 화살표의 부드러운 움직임 구현
        - **우선순위 큐(Queue) 기반 TTS 및 STT 비동기 리스너**: 일반 안내와 긴급 장애물 음성 알림의 우선순위 큐 제어 및 음성 명령어("종료", "그만") 실시간 감지를 위한 STT 무한 루프 구현
        - **경로 이탈 감지 및 방향 유도 알고리즘**: 사용자의 실시간 진행 각도와 다음 목적지 방위각을 비교 계산하여, 이탈 시 사용자 중심 시계 방향(예: "3시 방향으로 돌아주세요")으로 직관적인 대피 경로 안내
        
    - `UI/userUI/NpuTfliteBridge.ts`: Android TFLite 네이티브 플러그인 연동 Bridge
    - `UI/userUI/src/utils/audio.ts`: Capacitor 기반 STT/TTS 기능 구현 유틸리티

- 관리자 앱은 Dashboard, Heatmap, Database, Settings view와 modal/table/sidebar component로 구성했습니다.
    - `UI/adminUI/App.tsx`: Dashboard, Heatmap, Database, Settings view와 modal/table/sidebar component로 구성
    - `UI/adminUI/views/Dashboard.tsx`: Dashboard view
    - `UI/adminUI/views/Heatmap.tsx`: Heatmap view
    - `UI/adminUI/views/Database.tsx`: Database view

### Backend 관련 폴더

- FastAPI 앱은 `/health`, `/static`, `/api/v1/reports`, `/api/v1/navigation/path`를 구성했습니다. 근거: `backend/app/main.py`
- 신고 API, 관리자 API, 경로 API가 endpoint 파일로 분리되어 있습니다. 근거: `backend/app/api/v1/endpoints/reports.py`, `backend/app/api/v1/endpoints/admin.py`, `backend/app/api/v1/endpoints/navigation.py`
- DB 접근은 SQLAlchemy session과 raw SQL로 구현했습니다. 근거: `backend/app/core/database.py`, `backend/app/crud/report.py`
- 이미지 업로드는 boto3 기반 S3 uploader로 분리했습니다. 근거: `backend/app/services/s3_uploader.py`

### AI/model/data 관련 폴더

- 서비스 앱에는 TFLite 모델과 Android native plugin이 포함되어 있습니다. 근거: `UI/userUI/public/wasm/best_float32.tflite`, `UI/userUI/android/app/src/main/assets/best_float32.tflite`, `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

### 설정 파일

| 항목 | 파일 |
|---|---|
| 사용자 앱 npm 설정 | `UI/userUI/package.json` |
| 관리자 앱 npm 설정 | `UI/adminUI/package.json` |
| 백엔드 Python 의존성 | `backend/requirements.txt` |
| 환경변수 템플릿 | `.env.example` |
| Devcontainer Dockerfile | `.devcontainer/Dockerfile` |
| Devcontainer docker-compose | `.devcontainer/docker-compose.yml` |
| Capacitor 설정 | `UI/userUI/capacitor.config.ts` |
| Android Gradle 설정 | `UI/userUI/android/app/build.gradle` |
| Vite 설정 | `UI/userUI/vite.config.ts`, `UI/adminUI/vite.config.ts` |

### 실행 파일

- 백엔드는 `python run.py`로 Uvicorn을 실행하도록 구성했습니다. 근거: `backend/run.py`
- 사용자 앱과 관리자 앱은 `npm run dev`, `npm run build`, `npm run preview` script를 제공합니다. 근거: `UI/userUI/package.json`, `UI/adminUI/package.json`
- 사용자 앱 Android 프로젝트는 Gradle wrapper와 Android 설정을 포함합니다. 근거: `UI/userUI/android/gradlew`, `UI/userUI/android/app/build.gradle`

## 2. 기술 스택 근거

| 영역 | 기술 | 근거 |
|---|---|---|
| User Frontend | React 19, Vite, TypeScript | `UI/userUI/package.json` |
| User Mobile Bridge | Capacitor Android, Geolocation, Speech Recognition, Text-to-Speech, Device, Filesystem, Motion | `UI/userUI/package.json`, `UI/userUI/capacitor.config.ts` |
| User UI/Map/Camera | React Webcam, Leaflet, React Leaflet, Lucide, uuid | `UI/userUI/package.json` |
| Admin Frontend | React 19, Vite, TypeScript | `UI/adminUI/package.json` |
| Admin Data/UI | Supabase JS, Leaflet, React Leaflet, Recharts, Lucide | `UI/adminUI/package.json` |
| Backend | FastAPI, Uvicorn, python-dotenv, boto3, SQLAlchemy, psycopg2-binary, Pydantic, python-multipart | `backend/requirements.txt` |
| DB | PostgreSQL 연결 문자열, SQLAlchemy engine | `.env.example`, `backend/app/core/database.py` |
| 공간 데이터 | PostGIS 함수 `ST_SetSRID`, `ST_MakePoint`, `ST_X`, `ST_Y` 사용 | `backend/app/crud/report.py` |
| Object Storage | AWS S3 업로드 | `backend/app/services/s3_uploader.py` |
| External API | TMAP POI/보행자 경로 API | `UI/userUI/src/api/tmap.ts`, `backend/app/api/v1/endpoints/navigation.py` |
| On-device AI | TensorFlow Lite Java Interpreter, TFLite GPU dependency, Capacitor plugin | `UI/userUI/android/app/build.gradle`, `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java` |

확인된 설정 보완점:

(현재 모든 패키지 의존성이 정상적으로 해결되었습니다.)

## 3. Backend 근거

### API endpoint 목록

| Method | Path | 역할 | 근거 |
|---|---|---|---|
| GET | `/health` | 서버 상태 확인 | `backend/app/main.py` |
| Static | `/static` | `uploads` 디렉토리 정적 파일 서빙 | `backend/app/main.py` |
| POST | `/api/v1/reports/` | 위험 신고 이미지/메타데이터 업로드, S3 저장, DB insert | `backend/app/api/v1/endpoints/reports.py` |
| GET | `/api/v1/reports/` | 관리자 신고 목록 조회 | `backend/app/api/v1/endpoints/admin.py` |
| PATCH | `/api/v1/reports/{item_id}` | 신고 상태 변경 | `backend/app/api/v1/endpoints/admin.py` |
| DELETE | `/api/v1/reports/{item_id}` | 신고 숨김 처리 | `backend/app/api/v1/endpoints/admin.py` |
| POST | `/api/v1/navigation/path` | TMAP 보행자 경로 요청 후 안내 지점/path 반환 | `backend/app/api/v1/endpoints/navigation.py` |

### Request/response schema

- 신고 생성 API는 `item_id`, `user_id`, `latitude`, `longitude`, `hazard_type`, `risk_level`, `description`, `file`을 `Form`/`File`로 받습니다. 근거: `backend/app/api/v1/endpoints/reports.py`
- 신고 생성 응답은 `status`, `message`, `data`를 반환합니다. 근거: `backend/app/api/v1/endpoints/reports.py`
- 관리자 목록 응답은 `total`, `data`를 반환합니다. 근거: `backend/app/api/v1/endpoints/admin.py`
- 경로 요청은 Pydantic `NavigationRequest`로 `start_lat`, `start_lon`, `end_lat`, `end_lon`을 받습니다. 응답은 `status`, `data`, `path`를 반환합니다. 근거: `backend/app/api/v1/endpoints/navigation.py`
- 공통 schema 파일 `app/models/schemas.py`는 비어 있습니다. 근거: `backend/app/models/schemas.py`

### Router/controller/service 구조

- `main.py`가 CORS, static mount, router 등록을 담당합니다. 근거: `backend/app/main.py`
- 신고 endpoint는 HTTP request를 받고 S3 upload service와 CRUD 함수를 호출합니다. 근거: `backend/app/api/v1/endpoints/reports.py`, `backend/app/services/s3_uploader.py`, `backend/app/crud/report.py`
- 관리자 endpoint는 count/list/update/delete CRUD 함수를 호출합니다. 근거: `backend/app/api/v1/endpoints/admin.py`, `backend/app/crud/report.py`
- 경로 endpoint는 endpoint 내부에서 TMAP API를 호출하고 응답을 변환합니다. 근거: `backend/app/api/v1/endpoints/navigation.py`

### DB 연결 여부

- `DATABASE_URL` 환경변수로 SQLAlchemy engine을 생성합니다. 근거: `backend/app/core/database.py`
- `public.reports` 테이블에 raw SQL로 insert/select/update를 수행합니다. 근거: `backend/app/crud/report.py`
- 위치는 PostGIS point로 저장하고 조회 시 위도/경도를 `ST_Y`, `ST_X`로 꺼냅니다. 근거: `backend/app/crud/report.py`
- DB schema 생성 SQL과 PostGIS extension 생성 스크립트는 확인되지 않았습니다. `[확인 필요: DB schema 원본 및 PostGIS 설정]`

### 외부 API 호출 여부

- TMAP 보행자 경로 API를 호출합니다. 근거: `backend/app/api/v1/endpoints/navigation.py`
- 사용자 앱에서도 TMAP POI, 보행자 경로, reverse geocoding API 호출 코드가 있습니다. 근거: `UI/userUI/src/api/tmap.ts`
- 관리자 앱은 Nominatim reverse geocoding을 호출해 주소를 보강합니다. 근거: `UI/adminUI/App.tsx`
- 이미지는 AWS S3에 업로드합니다. 근거: `backend/app/services/s3_uploader.py`

### 예외 처리

- `DATABASE_URL`이 없으면 서버 import 단계에서 RuntimeError를 발생시킵니다. 근거: `backend/app/core/database.py`
- S3 bucket 이름이 없으면 신고 생성 API가 500 오류를 반환합니다. 근거: `backend/app/api/v1/endpoints/reports.py`
- S3 upload 실패는 500 `S3 Upload Failed`로 반환합니다. 근거: `backend/app/api/v1/endpoints/reports.py`, `backend/app/services/s3_uploader.py`
- 관리자 상태 변경은 허용 status가 아니면 400, row가 없으면 404를 반환합니다. 근거: `backend/app/api/v1/endpoints/admin.py`
- DB insert/update/delete 실패 시 rollback 후 예외를 다시 발생시킵니다. 근거: `backend/app/crud/report.py`

### 인증/인가 여부

- `.env.example`에는 `SECRET_KEY`, `ALGORITHM` 항목이 있습니다. 근거: `.env.example`
- FastAPI 인증/인가 router, dependency, token 검증 코드는 확인되지 않았습니다. `[확인 필요: 인증/인가 구현 여부]`

### 실행 방법

- 백엔드는 `backend/run.py`로 `app.main:app`을 `0.0.0.0:8000`에서 실행합니다. 근거: `backend/run.py`
- devcontainer는 Python 3.10, Node.js 20, OpenJDK 17, PostgreSQL, Redis를 구성합니다. 근거: `.devcontainer/Dockerfile`, `.devcontainer/docker-compose.yml`

### Swagger/FastAPI docs 여부

- FastAPI 앱에서 `docs_url=None` 같은 docs 비활성화 설정은 확인되지 않았습니다. 실제 `/docs`, `/redoc` 노출은 실행 확인이 필요합니다. 근거: `backend/app/main.py`

### 백엔드-프론트 계약 점검

- 백엔드 CRUD는 숨김 상태를 `Hidden`으로 사용하고, 관리자 Supabase 조회는 `hidden` 소문자를 제외합니다. 근거: `backend/app/crud/report.py`, `UI/adminUI/App.tsx`

## 4. Frontend 근거

### 페이지 구조

- 사용자 앱은 React Router가 아니라 `currentScreen` state와 `AppScreen` enum으로 화면을 전환합니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/types.ts`
- 사용자 앱 화면은 `IdleScreen`, `ListeningScreen`, `RetryScreen`, `ConfirmationScreen`, `GuidingScreen`으로 분리되어 있습니다. 근거: `UI/userUI/components`
- 관리자 앱은 `activePage` state로 `Dashboard`, `Heatmap`, `Database` view를 전환합니다. 근거: `UI/adminUI/App.tsx`

### 주요 컴포넌트

- 사용자 앱: `VisionCamera`, `GuidingScreen`, `ListeningScreen`, `ConfirmationScreen`, `RetryScreen`, `IdleScreen`, `DebugMap`. 근거: `UI/userUI/components`
- 관리자 앱: `Sidebar`, `HazardTable`, `HazardModal`, `ActionReportModal`, `Dashboard`, `Heatmap`, `Database`. 근거: `UI/adminUI/components`, `UI/adminUI/views`

### 상태 관리 방식

- 사용자 앱은 `useState`, `useEffect`로 위치, 목적지, 경로 안내 단계, 지도 path, 화면 상태를 관리합니다. 근거: `UI/userUI/App.tsx`
- `GuidingScreen`은 GPS watch, compass heading, route progress, off-route warning, obstacle TTS queue를 component state/ref로 관리합니다. 근거: `UI/userUI/components/GuidingScreen.tsx`
- 관리자 앱은 신고 목록, 선택 신고, dark mode, heatmap focus, sidebar open state를 React state로 관리합니다. 근거: `UI/adminUI/App.tsx`
- Redux, Zustand, React Query 사용 근거는 확인되지 않았습니다.

### API 호출 방식

- 사용자 앱은 `fetch`로 신고 FormData를 백엔드 `/api/v1/reports/`에 전송합니다. 근거: `UI/userUI/src/api/report.ts`
- 사용자 앱은 `CapacitorHttp.post`로 백엔드 `/api/v1/navigation/path/`에 경로를 요청합니다. 근거: `UI/userUI/src/api/backend.ts`
- 사용자 앱은 `CapacitorHttp`로 TMAP POI/reverse geocoding API를 호출합니다. 근거: `UI/userUI/src/api/tmap.ts`
- 관리자 앱은 Supabase JS로 `reports` table을 조회하고 `postgres_changes` INSERT를 구독합니다. 근거: `UI/adminUI/App.tsx`
- 관리자 앱은 `fetch`로 백엔드 목록/상태변경 API를 호출하는 helper도 포함합니다. 근거: `UI/adminUI/src/api/adminApi.ts`

### 로딩/에러 처리

- 사용자 앱은 GPS 권한 거부, 검색 실패, 경로 탐색 실패를 TTS, retry 화면, alert/debug 정보로 처리합니다. 근거: `UI/userUI/App.tsx`
- 신고 전송 실패와 경로 요청 실패는 error log 후 throw합니다. 근거: `UI/userUI/src/api/report.ts`, `UI/userUI/src/api/backend.ts`
- `VisionCamera`는 모델 로딩/추론/전송 상태를 화면 overlay로 표시하고 오류 시 `에러 발생` 상태를 표시합니다. 근거: `UI/userUI/components/VisionCamera.tsx`
- 관리자 앱은 Supabase fetch 실패, 상태 변경 실패, batch delete 실패를 console log와 alert로 처리합니다. 근거: `UI/adminUI/App.tsx`, `UI/adminUI/components/ActionReportModal.tsx`, `UI/adminUI/views/Database.tsx`

### localStorage/sessionStorage 사용 여부

- `localStorage`, `sessionStorage` 사용 코드는 확인되지 않았습니다. 근거: `rg -n "localStorage|sessionStorage" UI/userUI UI/adminUI` 결과 없음

### 라우팅 여부

- `react-router` dependency와 `BrowserRouter`, `Routes`, `Route` 사용 코드는 확인되지 않았습니다. 화면 전환은 state 기반입니다. 근거: `UI/userUI/package.json`, `UI/adminUI/package.json`, `UI/userUI/App.tsx`, `UI/adminUI/App.tsx`

### 반응형/스타일링 방식

- 사용자 앱은 Tailwind 계열 className과 full-screen 모바일 UI를 사용합니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/components/*.tsx`
- 관리자 앱은 Tailwind className, dark mode class, responsive grid, Leaflet/Recharts를 사용합니다. 근거: `UI/adminUI/App.tsx`, `UI/adminUI/views/Dashboard.tsx`, `UI/adminUI/views/Heatmap.tsx`, `UI/adminUI/views/Database.tsx`

## 5. AI Engineer 근거

### 데이터셋 위치 또는 데이터 수집 코드

- 별도 데이터 수집 코드나 라벨링 스크립트는 확인되지 않았습니다.

### 전처리 코드

- 사용자 앱은 webcam screenshot을 640x640 black canvas에 letterbox 방식으로 그린 뒤 base64 JPEG로 변환합니다. 근거: `UI/userUI/components/VisionCamera.tsx`
- Android native plugin은 base64 이미지를 decode하고 TFLite input tensor shape에 맞춰 resize합니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

### 모델 학습 코드


### 추론 코드

- 사용자 앱은 `VisionCamera`가 `NpuTflite.loadModel`, `NpuTflite.detect`, `YoloParser.parse`, `sendHazardReport` 흐름으로 추론 결과를 서비스 신고와 연결합니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/NpuTfliteBridge.ts`, `UI/userUI/src/utils/YoloParser.ts`, `UI/userUI/src/api/report.ts`
- Android plugin은 TensorFlow Lite `Interpreter`로 모델을 로드하고 output tensor를 JS array로 반환합니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

### 사용 모델명

- 서비스 앱 모델 asset: `best_float32.tflite`. 근거: `UI/userUI/public/wasm/best_float32.tflite`, `UI/userUI/android/app/src/main/assets/best_float32.tflite`
- `model/new2.py`는 `yolo11n.pt`를 사용하는 별도 이미지 추론 스크립트입니다. 근거: `model/new2.py`, `model/yolo11n.pt`

### 평가 코드 및 성능 결과 파일

- mAP, precision, recall, F1, confusion matrix, `results.csv` 파일은 확인되지 않았습니다. `[확인 필요: 성능 결과 파일 또는 실험 로그]`

### LLM/RAG/OCR/VectorDB 사용 여부

- LLM, RAG, OCR, VectorDB 사용 코드는 확인되지 않았습니다.

### 프롬프트 또는 체인 구성

- 프롬프트, chain, agent 구성 코드는 확인되지 않았습니다.

### 모델 결과가 서비스에 연결되는 방식

- TFLite 추론 결과는 `YoloParser`에서 class, confidence, normalized box로 후처리됩니다. 근거: `UI/userUI/src/utils/YoloParser.ts`
- `VisionCamera`는 화면 중앙 하단에 가까운 box를 primary hazard로 선택하고, 거리/방향/risk level을 계산해 TTS 경고와 신고 업로드에 사용합니다. 근거: `UI/userUI/components/VisionCamera.tsx`
- 신고 업로드는 이미지와 위치/위험도 metadata를 백엔드로 전송합니다. 근거: `UI/userUI/src/api/report.ts`, `backend/app/api/v1/endpoints/reports.py`

## 6. 불확실한 내용

| 항목 | 현재 상태 | 포트폴리오 처리 |
|---|---|---|
| 실제 개발 기간/팀원 수/본인 역할 | 코드 근거 없음 | `Portfolio_TODO.md` |
| 배포 링크 | URL 또는 배포 설정 근거 없음 | `[확인 필요: 배포 URL 또는 배포 설정 필요]` |
| 실행 화면 캡처/GIF | 이미지/시연 산출물 확인 안 됨 | `[확인 필요: 실제 실행 화면 캡처 필요]` |
| DB schema | create table index, PostGIS extension 근거 부족 | `Portfolio_TODO.md` |
| AI 성능 지표 | 결과 파일 없음 | `Portfolio_TODO.md` |

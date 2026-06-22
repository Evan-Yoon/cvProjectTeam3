# WalkMate 🦯

> 시각장애인을 위한 AI 기반 길 안내 및 킥보드 자동 신고 서비스

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android%20%7C%20iOS-119EFF?style=flat&logo=capacitor&logoColor=white)
![YOLOv11](https://img.shields.io/badge/YOLO-v11n-00FFFF?style=flat)
![TFLite](https://img.shields.io/badge/TFLite-On--Device-FF6F00?style=flat&logo=tensorflow&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS-S3-232F3E?style=flat&logo=amazonaws&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase&logoColor=white)

---

## 개요

WalkMate는 시각장애인이 안전하게 보행할 수 있도록 두 가지 핵심 기능을 제공합니다.

1. **음성 기반 길 안내** — 목적지를 말하면 TMAP 보행자 경로를 따라 TTS로 방향을 안내합니다.
2. **킥보드·장애물 자동 신고** — 온디바이스 TFLite 모델이 실시간으로 위험 요소를 탐지하고 관리자에게 자동 신고합니다.

관리자는 별도의 웹 대시보드에서 신고 현황을 실시간으로 모니터링하고 처리 상태를 관리합니다.

---

## 시스템 아키텍처

```mermaid
graph TD
    subgraph "사용자 앱 (Capacitor - Android/iOS)"
        A[음성 입력 STT] --> B[목적지 파싱]
        B --> C[FastAPI 경로 요청]
        D[카메라 실시간 촬영] --> E[TFLite 온디바이스 추론]
        E --> F{위험 요소 탐지?}
        F -- Yes --> G[자동 신고 전송]
    end

    subgraph "FastAPI 백엔드"
        C --> H[TMAP 보행자 API 프록시]
        G --> I[이미지 S3 업로드]
        I --> J[PostgreSQL PostGIS 저장]
    end

    subgraph "관리자 대시보드 (React)"
        J --> K[실시간 신고 목록]
        J --> L[지도 히트맵]
        J --> M[통계 차트]
    end

    H --> N[TTS 음성 안내]
```

---

## 주요 기능

### 사용자 앱
- **음성 전용 UI** — 시각 의존 없이 터치 한 번 + 음성으로 모든 조작 가능
- **TTS/STT 길 안내** — TMAP 보행자 경로 기반, 교차로마다 방향 음성 안내
- **GPS + 나침반 센서 퓨전** — 이동 방향을 정밀하게 계산해 경로 이탈 감지
- **온디바이스 객체 탐지** — YOLOv11n TFLite 모델로 킥보드·볼라드·차량 등 실시간 탐지 (GPU/NPU 델리게이트 활용)
- **자동 신고** — 위험 요소 탐지 시 위치 정보 + 이미지를 백엔드에 자동 전송

### 관리자 대시보드
- **실시간 신고 목록** — Supabase Realtime으로 신규 신고 즉시 반영
- **지도 히트맵** — 신고 위치를 Leaflet 지도에 시각화
- **처리 상태 관리** — new → processing → done 단계별 상태 변경
- **통계 차트** — 위험 등급별 분포, 시간대별 신고 추이

---

## 스크린샷

### 사용자 앱 화면 플로우

<!-- TODO: IdleScreen → ListeningScreen → GuidingScreen 세 화면을 가로로 나란히 배치한 이미지 추가 -->
> 📌 **[스크린샷 추가 필요]** 대기 화면 → 음성 입력 화면 → 길안내 화면 순서로 캡처 후 삽입

### 관리자 대시보드 — 메인 대시보드

<!-- TODO: Dashboard 뷰 스크린샷 (통계 카드 + 바 차트 + 라인 차트) 추가 -->
> 📌 **[스크린샷 추가 필요]** `views/Dashboard.tsx` 실행 화면 캡처 후 삽입

### 관리자 대시보드 — 히트맵

<!-- TODO: Heatmap 뷰 스크린샷 (Leaflet 지도 + 신고 위치 마커) 추가 -->
> 📌 **[스크린샷 추가 필요]** `views/Heatmap.tsx` 실행 화면 캡처 후 삽입

### 신고 → 대시보드 연결 흐름

<!-- TODO: 앱 탐지 화면(또는 신고 전송 로그)과 대시보드 신규 신고 항목을 나란히 배치한 이미지 추가 -->
> 📌 **[스크린샷 추가 필요]** 앱 자동 신고 발생 → 대시보드 반영 장면 캡처 후 삽입

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 사용자 앱 | React 18, TypeScript, Capacitor (Android / iOS) |
| 객체 탐지 | YOLOv11n → TFLite (온디바이스, GPU/NPU 델리게이트) |
| 음성 | TTS / STT (Capacitor 플러그인) |
| 지도 / 경로 | TMAP 보행자 API, Leaflet |
| 관리자 UI | React 18, Vite, Tailwind CSS, Recharts, Leaflet |
| 백엔드 | FastAPI, SQLAlchemy, PostgreSQL + PostGIS |
| 이미지 저장 | AWS S3 |
| DB 호스팅 | Supabase (PostgreSQL + Realtime) |
| 모델 학습 | Ultralytics YOLOv11, Google Colab |

---

## 프로젝트 구조

```
cvProjectTeam3/
├── UI/
│   ├── adminUI/     # 관리자 대시보드 (React + Vite)
│   └── userUI/      # 사용자 모바일 앱 (React + Capacitor)
├── backend/         # FastAPI 서버
├── model/           # YOLO 모델 학습 및 실험
└── yolo11n.pt       # YOLOv11n 기본 가중치
```

각 파일별 상세 역할 → [`project structure.md`](./project%20structure.md)

---

## 시작하기

### 방법 A — Dev Container (권장)

VS Code + Docker가 설치되어 있다면 원클릭으로 전체 개발 환경을 구성할 수 있습니다.
PostgreSQL(PostGIS), Redis, Python, Node.js가 모두 컨테이너 안에 자동 설치됩니다.

1. VS Code에서 [Dev Containers 확장](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) 설치
2. 프로젝트 루트를 VS Code로 열기
3. 명령 팔레트 (`Cmd+Shift+P`) → `Dev Containers: Reopen in Container` 실행
4. `postCreateCommand`가 자동으로 `pip install` 및 `npm install`을 수행합니다.

컨테이너가 뜨면 아래 포트가 자동으로 포워딩됩니다.

| 포트 | 서비스 |
|------|--------|
| `8000` | FastAPI 백엔드 |
| `5173` | 관리자 대시보드 (Vite) |
| `3000` | 사용자 앱 개발 서버 |
| `5432` | PostgreSQL |
| `6379` | Redis |

> **참고** — Dev Container 내부 DB(`postgresql+psycopg2://walkmate_user:walkmate_pass@postgres:5432/walkmate_db`)는 로컬 개발용입니다. 실제 배포 시에는 `backend/.env`의 `DATABASE_URL`을 Supabase로 교체하세요.

---

### 방법 B — 로컬 수동 설치

#### 사전 요구사항

- Python 3.11+
- Node.js 18+
- Android Studio (사용자 앱 Android 빌드 시)
- Supabase 프로젝트 및 AWS S3 버킷

---

### 1. 백엔드 실행

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 아래 환경 변수 입력 (환경 변수 명세 섹션 참고)

# 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 2. 관리자 대시보드 실행 (방법 B)

```bash
cd UI/adminUI

npm install

# 환경 변수 설정
cp .env.example .env
# VITE_BACKEND_URL 입력

npm run dev
```

---

### 3. 사용자 앱 실행 (방법 B)

```bash
cd UI/userUI

npm install

# 환경 변수 설정
cp .env.example .env
# VITE_BACKEND_URL 입력

# 웹 빌드
npm run build

# Android 실행
npx cap sync android
npx cap open android  # Android Studio에서 실행
```

---

### 4. AI 모델 학습 (선택)

`model/total.ipynb`를 Google Colab에서 열어 실행합니다.
학습 완료 후 TFLite 변환 결과를 `UI/userUI/android/app/src/main/assets/best_float32.tflite`에 교체합니다.

---

## 환경 변수 명세

### backend/.env

| 변수명 | 설명 |
|--------|------|
| `DATABASE_URL` | Supabase PostgreSQL 연결 문자열 |
| `AWS_ACCESS_KEY_ID` | AWS IAM 액세스 키 |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM 시크릿 키 |
| `AWS_REGION` | S3 버킷 리전 (기본값: `ap-northeast-2`) |
| `S3_BUCKET_NAME` | 이미지 업로드 S3 버킷 이름 |
| `S3_PUBLIC_BASE_URL` | S3 퍼블릭 접근 기본 URL |
| `TMAP_API_KEY` | SK TMAP 보행자 경로 API 키 |
| `CORS_ORIGINS` | 허용할 오리진 목록 (쉼표 구분, 예: `http://localhost:5173`) |

### UI/adminUI/.env & UI/userUI/.env

| 변수명 | 설명 |
|--------|------|
| `VITE_BACKEND_URL` | FastAPI 서버 주소 (예: `http://localhost:8000`) |

---

## AI 모델

YOLOv11n을 베이스로 킥보드·볼라드·일반 보행 위험 클래스를 탐지하도록 파인튜닝했습니다.

**사용 데이터셋**
- Roboflow 킥보드 데이터셋
- Roboflow 볼라드 데이터셋
- COCO (사람, 차량, 신호등 등 보행 위험 클래스)

**실험 비교** (`model/exp_comparison/`)

| 실험 | 설명 |
|------|------|
| `baseline` | 기본 설정 (SGD, 고정 LR) |
| `adamw_cos` | AdamW 옵티마이저 + 코사인 LR 스케줄러 |
| `heavy_aug` | Heavy Augmentation 적용 |

최종 채택 모델은 `adamw_cos` 실험의 `best.pt`를 TFLite(float32)로 변환한 버전입니다.

---

## API 명세

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/health` | 서버 상태 확인 |
| `POST` | `/api/v1/reports` | 위험 신고 생성 (이미지 + 위치 + 위험 유형) |
| `GET` | `/api/v1/reports` | 관리자 신고 목록 조회 |
| `PATCH` | `/api/v1/reports/{item_id}` | 신고 처리 상태 변경 |
| `DELETE` | `/api/v1/reports/{item_id}` | 신고 삭제 (숨김 처리) |
| `POST` | `/api/v1/navigation/path` | 보행자 경로 조회 (TMAP 프록시) |

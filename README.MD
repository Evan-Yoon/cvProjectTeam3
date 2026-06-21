# WalkMate (SafeStep) 🦯

> **시각장애인을 위한 음성 기반 보행 내비게이션 어시스턴트**
> 카메라로 보행 장애물(볼라드 등)을 실시간 탐지하고, 음성으로 목적지를 입력받아 안전한 보행 경로를 안내합니다.

WalkMate는 스마트폰 카메라와 온디바이스 AI(YOLO11 → TFLite)를 활용해 보행 중 위험 요소를 인식하고, TMAP 보행자 경로 API를 통해 음성으로 길을 안내하는 모바일 애플리케이션입니다. 사용자는 화면을 보지 않고도 음성(STT/TTS)만으로 전체 기능을 사용할 수 있으며, 사용자가 신고한 위험 요소는 **관리자 대시보드**에서 실시간으로 수집·확인·처리됩니다.

이 프로젝트는 세 개의 주요 구성요소로 이루어집니다.

- **사용자 앱(`UI/userUI`)** — 시각장애인용 모바일 앱 (음성 안내 + 온디바이스 장애물 탐지)
- **관리자 대시보드(`UI/adminUI`)** — 신고 모니터링·통계·히트맵 웹 대시보드
- **백엔드(`backend`)** — FastAPI 기반 경로 프록시 및 신고 저장 API

---

## 📑 목차

- [주요 기능](#-주요-기능)
- [시스템 아키텍처](#-시스템-아키텍처)
- [기술 스택](#-기술-스택)
- [디렉토리 구조](#-디렉토리-구조)
- [시작하기](#-시작하기)
  - [사전 요구 사항](#사전-요구-사항)
  - [환경 변수 설정](#환경-변수-설정)
  - [1. 백엔드 실행](#1-백엔드-실행)
  - [2. 사용자 앱 실행](#2-사용자-앱-실행)
  - [3. 관리자 대시보드 실행](#3-관리자-대시보드-실행)
  - [4. 모델 학습 / 추론](#4-모델-학습--추론)
- [API 개요](#-api-개요)
- [데이터 흐름과 Supabase의 역할](#-데이터-흐름과-supabase의-역할)
- [AI 모델](#-ai-모델)
- [기여 / 브랜치 전략](#-기여--브랜치-전략)

---

## ✨ 주요 기능

### 사용자 앱

- **음성 기반 목적지 입력**: 음성 인식(STT)으로 목적지를 말하면 TMAP POI 검색으로 좌표를 찾습니다.
- **실시간 보행 경로 안내**: GPS 위치를 기준으로 TMAP 보행자 경로를 받아 음성(TTS)으로 턴바이턴 안내합니다.
- **온디바이스 장애물 탐지**: 카메라 영상에서 볼라드 등 보행 장애물을 YOLO11 기반 TFLite 모델로 단말기 내부에서 실시간 추론합니다.
- **위험 요소 신고**: 발견한 장애물의 사진·위치·위험도를 백엔드로 전송하면 S3에 이미지가 저장되고 DB에 기록됩니다.
- **고대비 접근성 UI**: 시각장애인을 위한 고대비 화면과 음성 중심 인터랙션으로 설계되었습니다.

### 관리자 대시보드

- **실시간 신고 수신**: Supabase Realtime 구독으로 새 신고가 들어오는 즉시 화면에 반영됩니다.
- **대시보드 / 통계**: 신고 현황을 Recharts 기반 차트로 시각화합니다.
- **히트맵**: Leaflet 지도 위에 위험 신고 위치를 히트맵으로 표시합니다.
- **신고 관리**: 처리 상태 변경(new/processing/done), 항목 삭제(숨김 처리)를 제공합니다.
- **주소 보강**: 좌표를 Nominatim 역지오코딩으로 사람이 읽을 수 있는 주소로 변환해 표시합니다.

---

## 🏗 시스템 아키텍처

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│   사용자 앱 (Capacitor/Android)  │        │   관리자 대시보드 (Web)          │
│   React 19 + Vite             │        │   React 19 + Vite + Tailwind  │
│  ┌────────────────────────┐  │        │  ┌────────────────────────┐  │
│  │ 음성(STT/TTS)·GPS·카메라  │  │        │  │ 대시보드 · 히트맵 · DB     │  │
│  │ 온디바이스 추론(TFLite)    │  │        │  │ 실시간 신고 모니터링        │  │
│  │ 지도(Leaflet)·TMAP       │  │        │  └────────────────────────┘  │
│  └────────────────────────┘  │        └───────┬───────────────┬──────┘
└──────┬────────────────┬──────┘                │               │
       │                │                  실시간 구독/조회   상태변경 등
   경로/POI 검색      신고/경로 요청              │               │
       │                │                       ▼               ▼
       ▼                ▼                  ┌──────────┐   ┌──────────────┐
┌────────────┐   ┌──────────────────────┐ │ Supabase │   │   백엔드        │
│  TMAP API  │   │   백엔드 (FastAPI)     │ │ Realtime │   │  (FastAPI)    │
│ 보행자경로/POI │   │  신고 저장 / 경로 프록시 │ │  + DB    │   │  관리자 API     │
└────────────┘   └──────┬───────────┬────┘ └────┬─────┘   └──────────────┘
                        │           │            │
                   PostgreSQL    AWS S3      (PostgreSQL을
                   (신고 데이터)  (신고 이미지)  Realtime로 노출)
```

- **사용자 앱** 은 GPS·카메라·마이크로 사용자와 상호작용하고, 장애물 탐지는 단말기에서 직접 수행하며, 신고는 백엔드로 전송합니다.
- **백엔드(FastAPI)** 는 TMAP 보행자 경로 프록시, 위험 신고 저장(S3 + PostgreSQL), 관리자용 신고 처리 API를 담당합니다.
- **관리자 대시보드** 는 신고 데이터의 **조회와 실시간 갱신을 Supabase** 로 처리하고, 일부 상태 변경 액션에서 백엔드(FastAPI)를 함께 사용합니다.
- **AI 모델** 은 YOLO11n을 볼라드 데이터셋으로 학습한 뒤 TFLite로 변환해 앱에 내장됩니다.

---

## 🛠 기술 스택

| 영역 | 기술 |
| --- | --- |
| **사용자 앱** | React 19, TypeScript, Vite 6, Capacitor 8 (Android) |
| **앱 기능** | Capacitor Geolocation / Motion / Device / Filesystem, Speech Recognition(STT), Text-to-Speech(TTS), react-webcam |
| **온디바이스 AI** | TensorFlow.js, tfjs-tflite (커스텀 NPU/TFLite 브리지) |
| **관리자 대시보드** | React 19, TypeScript, Vite 6, Tailwind CSS, Recharts, Supabase JS |
| **지도** | Leaflet, react-leaflet, TMAP API |
| **백엔드** | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic |
| **데이터/스토리지** | PostgreSQL, Redis, AWS S3, **Supabase (관리자 실시간 — 필수)** |
| **AI 학습** | Ultralytics YOLO11, PyTorch, OpenCV, Roboflow 데이터셋 |
| **인프라** | Docker (DevContainer) |

> **Supabase 참고**: 백엔드(FastAPI)와 사용자 앱은 Supabase를 사용하지 않지만, **관리자 대시보드는 신고 데이터의 조회·실시간 갱신을 Supabase에 의존** 합니다. 따라서 관리자 대시보드를 실행하려면 Supabase 프로젝트와 키 설정이 **필수** 입니다.

---

## 📂 디렉토리 구조

```
cvProjectTeam3/
├── backend/                  # FastAPI 백엔드 서버
│   ├── app/
│   │   ├── main.py           # FastAPI 진입점, 라우터/CORS/정적파일 마운트
│   │   ├── core/             # 설정(config), DB 연결(database)
│   │   ├── api/v1/endpoints/ # reports, navigation, admin 엔드포인트
│   │   ├── crud/             # DB 접근 로직 (report)
│   │   ├── models/           # Pydantic 스키마
│   │   └── services/         # S3 업로더 등
│   ├── run.py                # 개발 서버 실행 (uvicorn)
│   ├── migrate.py            # DB 마이그레이션 스크립트
│   └── requirements.txt
│
├── model/                    # AI 모델 학습 / 데이터셋
│   ├── total.ipynb           # 학습·평가 노트북
│   └── datasets/
│       ├── bollard-dataset/  # 볼라드 탐지 데이터셋 (Roboflow)
│       └── coco-dataset/     # COCO 참조 데이터셋
│
├── UI/
│   ├── userUI/               # 사용자 모바일 앱 (React + Capacitor)
│   │   ├── App.tsx           # 화면 전환 / 상태 관리
│   │   ├── components/       # Idle/Listening/Confirmation/Guiding 등 화면
│   │   ├── NpuTfliteBridge.ts# 온디바이스 TFLite 추론 브리지
│   │   ├── public/wasm/      # TFLite 런타임 및 변환 모델(best_float32.tflite)
│   │   ├── android/          # Capacitor Android 프로젝트
│   │   └── package.json
│   │
│   └── adminUI/              # 관리자 대시보드 (React + Vite + Tailwind)
│       ├── App.tsx           # Supabase 조회/실시간 구독, 페이지 라우팅
│       ├── views/            # Dashboard / Database / Heatmap / Settings
│       ├── components/       # Sidebar, HazardModal, HazardTable 등
│       ├── src/api/          # 백엔드(FastAPI) 연동 (adminApi.ts)
│       ├── .env.example      # Supabase / 백엔드 URL 환경 변수 템플릿
│       └── package.json
│
├── comparison_plot.png       # 모델 비교 결과 그래프
└── .env.example              # 루트(백엔드/앱) 환경 변수 템플릿
```

---

## 🚀 시작하기

### 사전 요구 사항

- **Node.js** 18+ 및 npm
- **Python** 3.10+
- **PostgreSQL** 및 **Redis** (Docker 권장)
- **Android Studio** (사용자 앱 빌드/배포 시)
- **Supabase 프로젝트** (관리자 대시보드 실행에 필수)
- **TMAP API Key**, **AWS S3** 자격 증명

### 환경 변수 설정

이 프로젝트는 두 개의 `.env`를 사용합니다. 루트(`.env`)는 백엔드와 사용자 앱용이고, `UI/adminUI/.env`는 관리자 대시보드용입니다.

```bash
cp .env.example .env                      # 백엔드 / 사용자 앱
cp UI/adminUI/.env.example UI/adminUI/.env # 관리자 대시보드
```

**루트(`.env`) 주요 변수**

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `REDIS_URL` | Redis 연결 문자열 |
| `SECRET_KEY` / `ALGORITHM` | JWT 인증 설정 |
| `CORS_ORIGINS` | 허용할 프론트엔드 오리진 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME` | 신고 이미지 저장용 S3 |
| `TMAP_API_KEY` | 백엔드 경로 요청용 TMAP 키 |
| `VITE_BACKEND_URL` | 프론트엔드가 호출할 백엔드 주소 |
| `VITE_TMAP_API_KEY` | 사용자 앱 POI 검색/지도용 TMAP 키 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | (선택) 백엔드에서 Supabase를 직접 쓸 경우 |

**관리자 대시보드(`UI/adminUI/.env`) 변수**

| 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | **(필수)** Supabase 프로젝트 URL — 신고 조회/실시간 구독 |
| `VITE_SUPABASE_ANON_KEY` | **(필수)** Supabase anon 키 |
| `VITE_BACKEND_URL` | 백엔드(FastAPI) 주소 — 이미지 서빙 및 상태 변경 액션 |

> ⚠️ `.env` 파일은 `.gitignore`에 포함되어 있으므로 절대 커밋하지 마세요.

### 1. 백엔드 실행

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # (선택) 가상환경
pip install -r requirements.txt

# (필요 시) DB 마이그레이션
python migrate.py

# 개발 서버 실행 (http://localhost:8000)
python run.py
```

서버 상태 확인: `GET http://localhost:8000/health` → `{"ok": true}`
API 문서: `http://localhost:8000/docs` (Swagger UI)

### 2. 사용자 앱 실행

```bash
cd UI/userUI
npm install

# 웹 개발 서버 (http://localhost:5173)
npm run dev

# Android 빌드/배포
npm run build
npx cap sync android
npx cap open android   # Android Studio에서 실행
```

### 3. 관리자 대시보드 실행

```bash
cd UI/adminUI
npm install

# 웹 개발 서버 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build
npm run preview
```

> 관리자 대시보드는 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 가 설정되어 있어야
> 신고 데이터 조회와 실시간 갱신이 동작합니다. 또한 Supabase의 `reports` 테이블에 대해
> **Realtime(postgres_changes)** 이 활성화되어 있어야 합니다.

### 4. 모델 학습 / 추론

```bash
# 단일 이미지 추론 예제
pip install ultralytics opencv-python
python detect.py        # result.jpg 생성

# 전체 학습/평가는 노트북 참고
#   model/total.ipynb
```

---

## 🔌 API 개요

베이스 URL: `http://localhost:8000`

### 보행 경로

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/v1/navigation/path` | 출발/도착 좌표로 TMAP 보행자 경로 조회 |

요청 예시:

```json
{
  "start_lat": 37.5665,
  "start_lon": 126.9780,
  "end_lat": 37.5700,
  "end_lon": 126.9820
}
```

### 위험 신고 (사용자)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/v1/reports/` | 이미지·위치·위험도 등을 포함한 신고 등록 (multipart) |

### 위험 신고 (관리자)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/v1/reports/` | 전체 신고 목록 조회 (페이지네이션) |
| `PATCH` | `/api/v1/reports/{item_id}` | 처리 상태 변경 (`new` / `processing` / `done`) |
| `DELETE` | `/api/v1/reports/{item_id}` | 항목 삭제 (숨김 처리) |

| 기타 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 서버 헬스 체크 |
| `GET` | `/static/{filename}` | 업로드된 신고 이미지 서빙 |

---

## 🔄 데이터 흐름과 Supabase의 역할

신고 데이터는 다음 흐름으로 이동합니다.

1. **사용자 앱** 이 장애물을 탐지/촬영하고 `POST /api/v1/reports/` 로 백엔드에 전송합니다.
2. **백엔드(FastAPI)** 가 이미지를 **S3**에 올리고 신고 레코드를 **PostgreSQL**에 저장합니다.
3. **관리자 대시보드** 는 이 신고 데이터를 **Supabase**를 통해 읽습니다.
   - 초기 로딩: Supabase 클라이언트로 `reports` 테이블 조회 (`status != 'hidden'`)
   - 실시간 갱신: Supabase **Realtime**(`postgres_changes`, INSERT) 구독으로 새 신고를 즉시 표시
4. 관리자가 상태를 변경하면 대시보드에서 처리되고, 이미지 등은 백엔드(`VITE_BACKEND_URL`)에서 서빙됩니다.

> 핵심: Supabase는 PostgreSQL 위에 실시간 구독 기능을 제공하는 BaaS로 사용됩니다.
> 백엔드가 저장한 동일 데이터베이스를 Supabase가 노출하면, 관리자 대시보드가 별도 폴링 없이
> 새 신고를 실시간으로 받아볼 수 있습니다. **이 때문에 관리자 대시보드에는 Supabase가 필수입니다.**

---

## 🤖 AI 모델

- **베이스 모델** : Ultralytics **YOLO11n** (`yolo11n.pt`)
- **타깃 클래스** : 보행 장애물 — **볼라드(bollard) 및 킥보드(kickboard)** 등 (`model/datasets/bollard-dataset`, Roboflow CC BY 4.0)
- **참조 데이터셋** : COCO 2017 (`model/datasets/coco-dataset`)
- **배포 형식** : 학습된 모델을 **TFLite(`best_float32.tflite`)** 로 변환하여 앱에 내장, TensorFlow.js + 커스텀 브리지(`NpuTfliteBridge.ts`)로 **온디바이스 추론** 수행
- **학습/평가 노트북** : `model/total.ipynb`, 모델 비교 결과는 `comparison_plot.png` 참고

---

## 🌿 기여 / 브랜치 전략

- 원격 저장소: `https://github.com/Evan-Yoon/cvProjectTeam3`
- 메인 브랜치: `main`
- 작업은 기능/담당자별 브랜치에서 진행 후 `main`으로 병합합니다.

기여 절차:

1. 이슈/작업 단위로 브랜치 생성 (`feat/...`, `fix/...`)
2. 변경 사항 커밋 (커밋 메시지는 `feat:`, `fix:`, `docs:` 등 prefix 사용)
3. Pull Request 생성 후 리뷰
4. `main` 병합

---

> 본 프로젝트는 시각장애인의 안전한 보행을 돕기 위한 팀 프로젝트(Team 3)입니다.

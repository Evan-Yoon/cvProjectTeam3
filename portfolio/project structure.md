# WalkMate - Project Structure

시각장애인을 위한 음성 기반 길안내와 보행 위험 요소 자동 신고 서비스.

## 루트 디렉토리

```
cvProjectTeam3/
├── UI/                               # 프론트엔드 영역
│   ├── adminUI/                      # 관리자 웹 대시보드
│   └── userUI/                       # 사용자 하이브리드 앱
├── backend/                          # FastAPI 백엔드 서버
├── model/                            # YOLO 모델 학습/평가 자료
├── portfolio/                        # 프로젝트 보고서, 포트폴리오 문서, 캡처 자료
└── .gitignore                        # Git 제외 규칙
```

---

## portfolio - 보고서/캡처 자료

프로젝트 구조, 백엔드, 프론트엔드, AI 모델, Supabase, 사용자/관리자 UI 분석 문서와 실행 화면 캡처를 모아 둔 문서 디렉토리다.

```
portfolio/
├── project structure.md             # 현재 문서
├── Portfolio_Backend.md             # 백엔드 포트폴리오 문서
├── Portfolio_Frontend.md            # 프론트엔드 포트폴리오 문서
├── Portfolio_AIEngineer.md          # AI 모델/엔지니어링 포트폴리오 문서
├── ai_model_report.md               # 모델 개발 과정 및 실험 분석 보고서
├── adminui_report.md                # 관리자 UI 구현 분석 보고서
├── userui_report.md                 # 사용자 앱 구현 분석 보고서
├── table_report.md                  # Supabase 테이블/연동 방식 보고서
└── capture/                         # FastAPI, Supabase, S3, Xcode, UI 테스트 캡처/GIF
```

---

## UI/adminUI - 관리자 웹 대시보드

React + Vite + TypeScript 기반의 관리자 웹 앱이다. Supabase Realtime에서 신고 데이터를 읽고, 대시보드/히트맵/마스터 DB 화면으로 위험 신고를 확인한다. 일부 상태 변경/삭제 기능은 `src/api/adminApi.ts`를 통해 FastAPI 백엔드도 호출한다.

```
UI/adminUI/
├── App.tsx                          # 앱 루트: Supabase 구독, 데이터 매핑, 화면 전환, 다크모드/사이드바 상태
├── index.tsx                        # React 진입점: ReactDOM.createRoot 사용
├── index.html                       # Vite HTML 템플릿
├── index.css                        # 전역 스타일
├── types.ts                         # HazardData, RiskLevel, Status, NavItem 타입
├── metadata.json                    # 앱 메타데이터
├── README.md                        # adminUI 안내 문서
│
├── components/
│   ├── ActionReportModal.tsx        # 신고 처리 상태 변경 모달, PATCH API 호출
│   ├── HazardModal.tsx              # 신고 상세 모달, 이미지 확대/지도 이동/처리 모달 연결
│   ├── HazardTable.tsx              # 신고 목록 테이블, 선택/상태/위험도 표시
│   └── Sidebar.tsx                  # 대시보드/히트맵/마스터 DB 사이드바
│
├── views/
│   ├── Dashboard.tsx                # 통계 카드, 위험도 차트, 시간대 차트, 최근 신고 테이블
│   ├── Heatmap.tsx                  # Leaflet 지도 기반 위험 위치 표시 및 현재 위치 이동
│   └── Database.tsx                 # 전체 신고 필터/정렬/페이지네이션/CSV 내보내기/삭제 처리
│
├── src/
│   ├── api/
│   │   └── adminApi.ts              # FastAPI 관리자 API 호출: 목록 조회, 상태 변경, 삭제
│   └── vite-env.d.ts                # Vite 타입 선언
│
├── Supabase/
│   └── tables.sql                   # Supabase/PostgreSQL reports 테이블 SQL
│
├── public/
│   └── walkmate_logo.png            # 관리자 UI 로고 이미지
│
├── package.json                     # npm 스크립트와 의존성
├── package-lock.json                # npm lockfile
├── vite.config.ts                   # Vite 설정
├── tailwind.config.js               # Tailwind 설정
├── postcss.config.js                # PostCSS 설정
├── tsconfig.json                    # TypeScript 설정
├── .env.example                     # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL 예시
└── .gitignore                       # adminUI 하위 Git 제외 규칙
```

주의할 점:
- `index.tsx`는 `ReactDOM.render`가 아니라 `ReactDOM.createRoot`를 사용한다.
- 현재 관리자 화면 전환은 `Dashboard`, `Heatmap`, `Database` 중심이며, 별도 `Settings.tsx`나 `src/pages/ReportsPage.tsx` 파일은 현재 체크아웃에 없다.
- 실제 `.env` 파일은 로컬 환경 변수 파일이므로 문서에는 예시 파일만 구조로 적는다.

---

## UI/userUI - 사용자 하이브리드 앱

React + Vite + Capacitor 기반 사용자 앱이다. GPS 위치 감시, 음성 TTS/STT, TMAP 장소 검색/경로 요청, 웹캠 기반 TFLite 객체 탐지, 위험 신고 업로드를 담당한다. 현재 체크아웃에는 `android/` 디렉토리와 `NpuTfliteBridge.ts`가 없으며, 객체 탐지는 `@tensorflow/tfjs-tflite`와 `public/wasm`의 TFLite 모델/런타임을 통해 동작하도록 구현되어 있다.

```
UI/userUI/
├── App.tsx                          # 앱 상태 머신: IDLE/LISTENING/RETRY/CONFIRMATION/GUIDING
├── index.tsx                        # React 진입점: createRoot 사용, StrictMode 제거
├── index.html                       # Vite HTML 템플릿
├── index.css                        # 전역 스타일
├── types.ts                         # AppScreen, GeoLocation, Destination 등 공통 타입
├── capacitor.config.ts              # Capacitor 설정: appId, webDir, allowNavigation, CapacitorHttp
├── metadata.json                    # 앱 메타데이터
├── README.md                        # userUI 안내 문서
│
├── components/
│   ├── IdleScreen.tsx               # 시작/대기 화면
│   ├── ListeningScreen.tsx          # 음성 입력 화면
│   ├── ConfirmationScreen.tsx       # 목적지 확인 화면
│   ├── RetryScreen.tsx              # 실패/재시도 화면
│   ├── GuidingScreen.tsx            # 길안내 화면: 경로 안내, 센서/위치 처리, 카메라 연결
│   ├── VisionCamera.tsx             # 웹캠 프레임 캡처, tfjs-tflite 추론, 위험 신고 전송
│   ├── DebugMap.tsx                 # 디버그 지도 표시
│   ├── Waveform.tsx                 # 음성 입력 파형 UI
│   └── utils/
│       └── audio.ts                 # src/utils/audio.ts 재export
│
├── src/
│   ├── api/
│   │   ├── backend.ts               # FastAPI /api/v1/navigation/path 호출
│   │   ├── report.ts                # multipart 신고 업로드 API 호출
│   │   └── tmap.ts                  # TMAP POI 검색, 보행자 경로, 역지오코딩 호출
│   └── utils/
│       ├── YoloParser.ts            # TFLite/YOLO 출력 파싱 및 NMS 처리
│       ├── audio.ts                 # Capacitor TTS/STT 및 웹 fallback
│       └── josa.ts                  # 한국어 조사 처리 유틸
│
├── public/
│   └── wasm/
│       ├── best_float32.tflite      # 기본 TFLite 모델
│       ├── tflite_web_api_client.js
│       ├── tflite_web_api_cc*.js
│       ├── tflite_web_api_cc*.wasm
│       └── *.worker.js              # threaded wasm worker 파일
│
├── ios/
│   ├── App/
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── Info.plist
│   │   │   ├── capacitor.config.json
│   │   │   ├── config.xml
│   │   │   ├── Assets.xcassets/
│   │   │   └── Base.lproj/
│   │   ├── App.xcodeproj/
│   │   ├── App.xcworkspace/
│   │   ├── Podfile
│   │   └── Podfile.lock
│   └── capacitor-cordova-ios-plugins/
│       ├── CordovaPlugins.podspec
│       ├── CordovaPluginsResources.podspec
│       ├── CordovaPluginsStatic.podspec
│       ├── resources/
│       └── sources/
│
├── assets/
│   ├── icon.png                     # 앱 아이콘
│   └── splash.png                   # 스플래시 이미지
│
├── patches/
│   ├── @capacitor+android+8.1.0.patch
│   ├── @capacitor+geolocation+8.1.0.patch
│   ├── @capacitor-community+speech-recognition+7.0.1.patch
│   └── @capacitor-community+text-to-speech+8.0.0.patch
│
├── build_log.txt                    # 빌드/문제 해결 로그
├── build_log_2.txt
├── build_log_3.txt
├── build_log_4.txt
├── build_log_5.txt
├── package.json                     # npm 스크립트와 의존성
├── package-lock.json                # npm lockfile
├── vite.config.ts                   # Vite 설정
├── tsconfig.json                    # TypeScript 설정
├── .env.example                     # VITE_BACKEND_URL, VITE_TMAP_API_KEY 예시
└── .gitignore                       # userUI 하위 Git 제외 규칙
```

주의할 점:
- 현재 `UI/userUI/android/` 디렉토리는 없다. 문서에 Android Java 플러그인 경로를 적으면 현재 구조와 맞지 않는다.
- 현재 `NpuTfliteBridge.ts` 파일도 없다. `VisionCamera.tsx`는 웹캠 + `@tensorflow/tfjs-tflite` + `public/wasm` 모델 기반이다.
- `ios/App/Pods/`와 `ios/App/App/public/`는 실제 로컬에 존재하지만 각각 CocoaPods 생성물과 Capacitor가 복사한 웹 번들이라 구조 설명에서 제외했다.

---

## backend - FastAPI 서버

Python FastAPI 서버다. 위험 신고 이미지를 S3에 업로드하고, PostgreSQL/PostGIS `reports` 테이블에 신고를 저장/조회/상태 변경/숨김 처리한다. TMAP 보행자 경로 API를 프록시하는 네비게이션 엔드포인트도 포함한다.

```
backend/
├── requirements.txt                 # Python 의존성: fastapi, uvicorn, boto3, sqlalchemy, psycopg2, requests 등
├── .env.example                     # DATABASE_URL, AWS/S3, TMAP_API_KEY, CORS_ORIGINS 예시
│
└── app/
    ├── __init__.py
    ├── main.py                      # FastAPI 앱 생성, CORS 설정, /health, reports/admin/navigation 라우터 등록
    │
    ├── core/
    │   ├── config.py                # dotenv 로드 및 DATABASE_URL, AWS/S3, TMAP, CORS 환경 변수 읽기
    │   └── database.py              # SQLAlchemy engine/session, get_db 의존성
    │
    ├── api/
    │   └── v1/
    │       └── endpoints/
    │           ├── reports.py       # POST /api/v1/reports/ - 신고 생성, S3 업로드, DB 저장
    │           ├── admin.py         # GET/PATCH/DELETE /api/v1/reports - 목록/상태 변경/숨김 처리
    │           └── navigation.py    # POST /api/v1/navigation/path - TMAP 보행자 경로 프록시
    │
    ├── crud/
    │   └── report.py                # reports 테이블 SQL: 생성, 목록, 카운트, 상태 변경, Hidden 처리
    │
    └── services/
        └── s3_uploader.py           # boto3 S3 put_object 업로드 및 공개 URL 생성
```

주의할 점:
- `main.py`에는 `/health`가 있으며, 별도 `/` root 라우트나 정적 파일 서빙 설정은 없다.
- `navigation.py`는 `requests`를 사용하고, 현재 `backend/requirements.txt`에도 `requests`가 포함되어 있다.
- 현재 체크아웃에는 `backend/app/models/` 디렉토리와 `schemas.py`가 없다. 신고 데이터 처리는 주로 endpoint, crud, database 모듈의 SQL/의존성으로 구성되어 있다.
- 실제 `.env` 파일은 로컬 환경 변수 파일이므로 문서에는 예시 파일만 구조로 적는다.

---

## model - AI 모델 학습/평가 자료

YOLO 기반 객체 탐지 모델 학습, 변환, 평가 산출물이 모여 있는 영역이다.

```
model/
├── total.ipynb                      # 메인 학습/병합/변환/평가 노트북
│
├── datasets/
│   ├── bollard-dataset/
│   │   ├── train/
│   │   ├── valid/
│   │   ├── test/
│   │   ├── data.yaml
│   │   ├── README.dataset.txt
│   │   └── README.roboflow.txt
│   ├── kickboard-dataset/
│   │   ├── train/
│   │   ├── valid/
│   │   ├── test/
│   │   ├── data.yaml
│   │   ├── README.dataset.txt
│   │   └── README.roboflow.txt
│   └── coco-dataset/
│       ├── annotations/
│       ├── images/
│       ├── labels/
│       ├── coco.yaml
│       ├── LICENSE
│       └── README.txt
│
├── exp_comparison/
│   ├── baseline/
│   │   ├── weights/
│   │   │   ├── best.pt
│   │   │   ├── last.pt
│   │   │   └── best_float32.tflite
│   │   ├── args.yaml
│   │   ├── results.csv
│   │   ├── results.png
│   │   ├── confusion_matrix*.png
│   │   ├── BoxF1/BoxP/BoxR/BoxPR_curve.png
│   │   └── train_batch*/val_batch* 이미지
│   ├── adamw_cos/
│   │   ├── weights/
│   │   │   ├── best.pt
│   │   │   └── last.pt
│   │   ├── args.yaml
│   │   ├── results.csv
│   │   ├── results.png
│   │   ├── confusion_matrix*.png
│   │   ├── BoxF1/BoxP/BoxR/BoxPR_curve.png
│   │   └── train_batch*/val_batch* 이미지
│   ├── heavy_aug/
│   │   ├── weights/
│   │   │   ├── best.pt
│   │   │   └── last.pt
│   │   ├── args.yaml
│   │   ├── results.csv
│   │   ├── results.png
│   │   ├── confusion_matrix*.png
│   │   ├── BoxF1/BoxP/BoxR/BoxPR_curve.png
│   │   └── train_batch*/val_batch* 이미지
│   └── comparison_plot.png
│
├── testphoto/
│   ├── images/                      # 실제 테스트 이미지 7장
│   ├── labels/                      # 테스트 이미지 YOLO 라벨 7개
│   ├── comparison_results/          # 추론 결과 이미지 7장
│   ├── data.yaml
│   └── screenshot1.png
│
└── Yolo11n Colab Legacy Code/
    ├── Untitled6.ipynb
    ├── Untitled8.ipynb
    ├── Untitled9.ipynb
    ├── Untitled10.ipynb
    ├── Untitled11.ipynb
    └── korean_street_object_detection_summary.md
```

---

## 로컬/생성 산출물

다음 항목은 현재 작업 디렉토리에 있거나 생성될 수 있지만, 소스 구조 설명에서는 제외한다.

```
.git/                              # Git 내부 데이터
.DS_Store                          # macOS Finder 메타데이터
.venv/                             # 로컬 Python 가상환경
UI/adminUI/node_modules/            # npm 의존성
UI/adminUI/dist/                    # Vite 빌드 결과
UI/adminUI/.vite/                   # Vite 캐시
UI/userUI/node_modules/             # npm 의존성
UI/userUI/dist/                     # Vite 빌드 결과
UI/userUI/ios/App/Pods/             # CocoaPods 생성물
UI/userUI/ios/App/App/public/       # Capacitor가 iOS 앱에 복사한 웹 번들/wasm 자산
backend/app/**/__pycache__/         # Python 바이트코드 캐시
*.pyc
```

---

## 기술 스택 요약

| 영역 | 현재 코드 기준 기술 |
|------|---------------------|
| 관리자 UI | React 19, Vite 6, TypeScript, Supabase JS, Recharts, Leaflet, Tailwind/PostCSS, lucide-react |
| 사용자 UI | React 19, Vite 6, TypeScript, Capacitor 8, iOS Capacitor 래퍼, CapacitorHttp/Geolocation/Motion/TTS/STT |
| 객체 탐지 | `@tensorflow/tfjs`, `@tensorflow/tfjs-tflite`, `public/wasm` TFLite 모델, YOLO 출력 파서 |
| 음성 | `@capacitor-community/text-to-speech`, `@capacitor-community/speech-recognition`, Web Speech fallback |
| 지도/경로 | TMAP POI/보행자 경로/역지오코딩, Leaflet/React Leaflet |
| 백엔드 | FastAPI, Uvicorn, SQLAlchemy, PostgreSQL/PostGIS, python-dotenv |
| 이미지 저장 | AWS S3, boto3 |
| DB/Realtime | Supabase PostgreSQL + Realtime 구독 |
| 모델 학습 | Ultralytics YOLO 계열 학습 산출물, TFLite 변환 산출물, Google Colab 노트북 |

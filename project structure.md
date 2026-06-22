# WalkMate — Project Structure

시각장애인을 위한 길 안내 및 킥보드 자동 신고 서비스

---

## 루트 디렉토리

```
cvProjectTeam3/
├── UI/                  # 프론트엔드 (관리자 대시보드 + 사용자 앱)
├── backend/             # FastAPI 백엔드 서버
├── model/               # YOLO 모델 학습 및 실험
├── yolo11n.pt           # YOLOv11n 기본 가중치 파일 (학습 베이스 모델)
├── .devcontainer/       # VS Code Dev Container 설정
└── .gitignore
```

---

## UI/adminUI — 관리자 대시보드

React + Vite + TypeScript로 구성된 웹 대시보드. 신고된 위험 요소를 실시간으로 모니터링하고 처리 상태를 관리한다.

```
UI/adminUI/
├── App.tsx                          # 앱 루트: 라우팅 및 전체 레이아웃 구성
├── index.tsx                        # React 진입점 (ReactDOM.render)
├── index.html                       # Vite HTML 템플릿
├── index.css                        # 전역 스타일
├── types.ts                         # 공통 TypeScript 타입 정의 (HazardData 등)
├── constants.tsx                    # 상수 값 (위험 유형, 상태 레이블 등)
│
├── components/
│   ├── HazardTable.tsx              # 신고 목록 테이블 컴포넌트
│   ├── HazardModal.tsx              # 신고 상세 정보 모달
│   ├── ActionReportModal.tsx        # 처리 상태 변경 모달 (new/processing/done)
│   └── Sidebar.tsx                  # 좌측 내비게이션 사이드바
│
├── views/
│   ├── Dashboard.tsx                # 대시보드 홈: 통계 카드, 바 차트, 라인 차트
│   ├── Heatmap.tsx                  # 지도 히트맵: Leaflet 기반 신고 위치 시각화
│   ├── Database.tsx                 # 전체 신고 DB 조회 및 필터링 뷰
│   └── Settings.tsx                 # 환경설정 뷰
│
├── src/
│   ├── api/
│   │   └── adminApi.ts              # 백엔드 REST API 호출 함수 (신고 목록 조회, 상태 변경, 삭제)
│   ├── pages/
│   │   └── ReportsPage.tsx          # 신고 관리 페이지 (목록 + 모달 연동)
│   └── vite-env.d.ts                # Vite 환경 변수 타입 선언
│
├── Supabase/
│   └── tables.sql                   # Supabase DB 테이블 생성 SQL (PostGIS, reports 테이블 스키마)
│
├── public/
│   └── walkmate_logo.png            # 로고 이미지
│
├── package.json                     # 의존성 및 스크립트
├── vite.config.ts                   # Vite 빌드 설정
├── tailwind.config.js               # Tailwind CSS 설정
├── tsconfig.json                    # TypeScript 컴파일러 설정
├── .env                             # 환경 변수 (백엔드 URL 등)
└── .env.example                     # 환경 변수 예시
```

---

## UI/userUI — 사용자 모바일 앱

React + Capacitor 기반 하이브리드 앱. TFLite 온디바이스 객체 탐지, GPS 길안내, 음성 TTS/STT를 통합하여 시각장애인이 사용할 수 있는 인터페이스를 제공한다.

```
UI/userUI/
├── App.tsx                          # 앱 루트: 화면 상태 관리 (idle → listening → guiding)
├── index.tsx                        # React 진입점
├── index.html                       # HTML 템플릿
├── index.css                        # 전역 스타일
├── NpuTfliteBridge.ts               # Capacitor 플러그인 브릿지: 네이티브 TFLite 추론 호출 인터페이스
├── capacitor.config.ts              # Capacitor 앱 설정 (앱 ID, 서버 URL 등)
│
├── components/
│   ├── IdleScreen.tsx               # 대기 화면: GPS 위치 확인 후 TTS로 안내 시작 유도
│   ├── ListeningScreen.tsx          # 음성 입력 화면: STT로 목적지 수신 및 파형 애니메이션
│   ├── ConfirmationScreen.tsx       # 목적지 확인 화면: 인식된 목적지 TTS 재확인
│   ├── RetryScreen.tsx              # 재시도 화면: 음성 인식 실패 시 재입력 유도
│   ├── GuidingScreen.tsx            # 길안내 화면: GPS 추적, 나침반 센서 퓨전, 경로 이탈 감지, TTS 안내
│   ├── VisionCamera.tsx             # 카메라 + TFLite 추론: 장애물 탐지 → 위험도 분류 → 자동 신고
│   ├── DebugMap.tsx                 # 디버그용 지도: 현재 위치 및 경로 시각화
│   ├── Waveform.tsx                 # 음성 입력 중 파형 애니메이션 UI 컴포넌트
│   └── utils/
│       └── audio.ts                 # TTS(speak), STT(startListening/stopListening) 유틸 함수
│
├── src/
│   ├── api/
│   │   ├── backend.ts               # 백엔드 API 호출: 경로 탐색 (TMAP), 네비게이션 데이터 타입
│   │   └── report.ts                # 위험 신고 전송 API (이미지 + 위치 + 위험 유형 multipart 전송)
│   └── utils/
│       └── YoloParser.ts            # YOLO 모델 출력 파싱: 바운딩 박스 NMS 처리 및 DetectedBox 변환
│
├── android/
│   ├── app/src/main/
│   │   ├── java/com/team3/walkmate/
│   │   │   ├── MainActivity.java    # Android 앱 진입점: Capacitor 플러그인 등록
│   │   │   └── NpuTflitePlugin.java # 네이티브 TFLite 추론 플러그인 (GPU/NPU 델리게이트 활용)
│   │   └── assets/
│   │       └── best_float32.tflite  # 온디바이스 추론용 TFLite 모델 (YOLO 변환본)
│   └── ...                          # Gradle 빌드 파일, 리소스, 스플래시 이미지 등
│
├── ios/
│   └── App/                         # iOS Xcode 프로젝트 (Capacitor iOS 래퍼)
│
├── assets/
│   ├── icon.png                     # 앱 아이콘
│   └── splash.png                   # 스플래시 스크린
│
├── package.json                     # 의존성 및 스크립트
├── vite.config.ts                   # Vite 빌드 설정
├── .env                             # 환경 변수 (백엔드 URL 등)
└── .env.example                     # 환경 변수 예시
```

---

## backend — FastAPI 서버

Python FastAPI 서버. 신고 데이터를 PostgreSQL(PostGIS)에 저장하고, S3 이미지 업로드, TMAP 보행자 경로 프록시 기능을 제공한다.

```
backend/
├── requirements.txt                 # Python 의존성 목록 (FastAPI, SQLAlchemy, boto3 등)
└── app/
    ├── __init__.py
    ├── main.py                      # FastAPI 앱 생성, CORS 설정, 라우터 등록, 정적 파일 서빙
    │
    ├── core/
    │   ├── config.py                # 환경 변수 로드 (DB URL, AWS 키, TMAP 키, CORS 등)
    │   └── database.py              # SQLAlchemy 엔진 및 세션 팩토리, get_db 의존성 함수
    │
    ├── api/v1/endpoints/
    │   ├── reports.py               # POST /api/v1/reports — 신고 생성 (이미지 S3 업로드 + DB 저장)
    │   ├── admin.py                 # GET/PATCH/DELETE /api/v1/reports — 관리자 목록 조회, 상태 변경, 삭제(숨김 처리)
    │   └── navigation.py            # POST /api/v1/navigation/path — TMAP 보행자 경로 API 프록시
    │
    ├── crud/
    │   └── report.py                # DB CRUD 함수 (PostGIS ST_MakePoint 활용): 생성, 조회, 상태 변경, 삭제
    │
    ├── models/
    │   └── schemas.py               # Pydantic 요청/응답 스키마 정의
    │
    └── services/
        └── s3_uploader.py           # AWS S3 이미지 업로드 서비스 (boto3, public-read ACL)
```

---

## model — AI 모델 학습

YOLOv11n 기반 객체 탐지 모델 학습 및 실험 관리. 킥보드, 볼라드 등 보행 위험 요소를 탐지하도록 파인튜닝한다.

```
model/
├── total.ipynb                      # 메인 학습 노트북: 데이터셋 병합, 모델 학습, TFLite 변환, 성능 평가
│
├── datasets/
│   ├── bollard-dataset/             # 볼라드 탐지 데이터셋 (Roboflow): train/valid/test + data.yaml
│   ├── kickboard-dataset/           # 킥보드 탐지 데이터셋 (Roboflow): train/valid/test + data.yaml
│   └── coco-dataset/                # COCO 일반 객체 데이터셋: 사람, 차량, 신호등 등 (보행 위험 클래스)
│
├── exp_comparison/                  # 실험 결과 비교
│   ├── baseline/                    # 기본 설정 실험 결과 (가중치, 학습 곡선, 혼동 행렬)
│   ├── adamw_cos/                   # AdamW + 코사인 스케줄러 실험 결과
│   ├── heavy_aug/                   # Heavy Augmentation 실험 결과
│   └── comparison_plot.png          # 실험 간 성능 비교 그래프
│
├── testphoto/                       # 실제 촬영 테스트 이미지 및 추론 결과
│   ├── images/                      # 원본 테스트 이미지
│   ├── labels/                      # 정답 레이블 (YOLO 형식)
│   ├── comparison_results/          # 모델 추론 결과 이미지
│   ├── data.yaml                    # 테스트 데이터셋 설정
│   └── screenshot1~3.png            # 결과 스크린샷
│
└── Yolo11n Colab Legacy Code/       # 초기 Colab 실험 노트북 모음 (레거시)
    ├── Untitled6~11.ipynb           # 단계별 실험 노트북
    └── korean_street_object_detection_summary.md  # 한국 도로 환경 객체 탐지 실험 요약
```

---

## .devcontainer — 개발 환경

```
.devcontainer/
├── Dockerfile                       # 백엔드 개발용 Python 컨테이너 이미지 정의
├── devcontainer.json                # VS Code Dev Container 설정
├── docker-compose.yml               # 서비스 구성 (백엔드 + DB 등)
└── start.sh                         # 컨테이너 시작 스크립트
```

---

## 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 사용자 앱 | React + TypeScript + Capacitor (Android/iOS) |
| 객체 탐지 | YOLOv11n → TFLite (온디바이스 추론, GPU/NPU 델리게이트) |
| 음성 | TTS / STT (Capacitor 플러그인) |
| 지도 / 경로 | TMAP 보행자 API, Leaflet |
| 관리자 UI | React + Vite + Tailwind CSS + Recharts + Leaflet |
| 백엔드 | FastAPI + SQLAlchemy + PostgreSQL (PostGIS) |
| 이미지 저장 | AWS S3 |
| DB 호스팅 | Supabase (PostgreSQL + Realtime) |
| 모델 학습 | Ultralytics YOLO, Google Colab |

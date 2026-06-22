# WalkMate (SafeStep) — 포트폴리오 상세 구성안 (코드 검증본)

> 시각장애인을 위한 음성 기반 보행 내비게이션 + 온디바이스 위험 탐지 + 신고/관리자 모니터링 서비스
> 작성 기준: **실제 레포지토리 코드 + Git 커밋 이력** 검증 (README 단독 추정 아님)

---

## 0. 먼저 — 기존 초안에서 코드와 다른 부분 (정정표)

원본 PPT 초안 대비, 실제 코드를 확인해 바로잡은 내용입니다. PPT에 그대로 쓰면 위험한 표현을 사실 기준으로 교체했습니다.

| 초안 표현 | 코드 확인 결과 | PPT 권장 표현 |
| --- | --- | --- |
| "React Native iOS 앱" / "React Native 사용 여부 확인" | 최종 앱에 **React Native 없음**. `package.json`은 `react` + `@capacitor/*`. (단, `react-native-web`은 웹 호환 패키지일 뿐) | **React 19 + TypeScript + Vite + Capacitor 8 (iOS/Android 동시 타깃)** |
| "iOS 앱인지 Android 앱인지 확인 필요" | `capacitor.config.ts` + `ios/`·`android/` 둘 다 존재, `@capacitor/ios`·`@capacitor/android` 모두 설치. 최근 커밋 `migrate iOS ... to CocoaPods` | **Capacitor로 iOS·Android 양쪽 빌드 구성** (실기기 시연 플랫폼만 명시) |
| "STT/TTS 구현 방식 확인 필요" | `src/utils/audio.ts`에서 **Capacitor Community 플러그인**(`@capacitor-community/speech-recognition`, `text-to-speech`)로 구현, `ko-KR` | **Capacitor 네이티브 STT/TTS (한국어)** |
| (언급 없음) | `services/liveClient.ts`에 **Google Gemini Live(실시간 음성 대화) 연동 코드**가 있으나, `App.tsx`/화면 컴포넌트 어디에서도 import되지 않음 → **미연결 실험 코드** | "초기에는 Gemini Live 실시간 음성 에이전트를 실험했고, 최종은 경량 Capacitor STT/TTS로 확정"으로 **실험/의사결정 스토리**로 활용 |
| "YOLO11n → TFLite, TensorFlow.js 브리지로 추론" | 추론은 **TFJS가 아니라 직접 만든 Capacitor 네이티브 플러그인 `NpuTflite`**(`NpuTfliteBridge.ts`) 호출. 모델은 `public/wasm/best_float32.tflite` | **커스텀 Capacitor 네이티브 TFLite 플러그인 + NPU delegate(폴백 CPU)로 온디바이스 추론** |
| "킥보드 클래스 포함 여부 확인 필요" | `kickboard-dataset/` 존재(nc:1), 추론 라벨맵(`YoloParser.COCO_CLASSES`)에 `kickboard` 포함(인덱스 12) | **bollard·kickboard 포함, 총 13개 클래스 탐지** |
| "S3 정적 호스팅 여부 확인" | S3는 **신고 이미지 저장 + public-read 객체 URL 제공**용. 정적 웹 호스팅 아님 | **신고 이미지 오브젝트 스토리지(S3, public-read)** |
| "PostgreSQL에 신고 저장" | 단순 RDB 아님. **PostGIS geometry(Point,4326)** 컬럼 + `ST_MakePoint`/`ST_X`/`ST_Y` 공간쿼리 | **PostGIS 기반 위치(geometry) 저장 및 공간 쿼리** |
| "Docker Compose 자동 배포" | `.devcontainer/docker-compose.yml` **존재하나 개발환경용**(workspace + **PostGIS** + Redis). 프로덕션/배포용 compose·CI는 없음 | **Docker Compose 기반 개발환경(앱+PostGIS+Redis 일괄 실행)**. "자동 배포"는 쓰지 않음 |
| "CI/CD / 배포 주기 단축" | 근거 없음 | **언급하지 않음** |

> 한 줄 결론: 이 프로젝트는 "AI도 해봤다"가 아니라 **시각장애인 UX → 온디바이스 AI 탐지 → 공간 데이터 신고 → 관리자 실시간 모니터링**으로 이어지는 풀스택 서비스 경험으로 보여주는 것이 가장 강합니다.

---

## 0-1. 본인(최현석) 실제 기여 — Git 커밋 기준 (정직하게 쓰기 위한 근거)

> 팀원 4명 공동 프로젝트. 커밋 이력상 본인 브랜치(`choihyunseok`, `Hyunseok-for-portfolio`)의 작업은 **AI 모델 학습/평가·온디바이스 추론 연동·모바일 앱 프로토타이핑**에 집중되어 있습니다. 백엔드/관리자 대시보드 본체는 다른 팀원(주 기여자) 작업이 큽니다. PPT에서는 아래를 **"본인 핵심 기여"**로, 나머지는 **"팀 구성/협업"**으로 분리해 쓰는 것이 안전하고 설득력 있습니다.

본인 커밋에서 확인되는 작업:

- **YOLO11 객체탐지 모델 학습** — Roboflow 데이터셋(볼라드/킥보드) + COCO 일부를 합쳐 학습, 200 epoch 학습본 업로드, **점자블록(Braille block) OBB 탐지 모델**까지 별도 실험 (`feat: Add trained OBB model artifacts...`, `점자블록 인식모델 업로드`)
- **TFLite 변환 및 입력 크기 튜닝** — `720 크기로 tflite모델 변환`, `best_float32.tflite`를 앱 `public/wasm/`에 배치
- **모델 추론 테스트 파이프라인** — OpenCV 전처리 기반 추론 검증 (`Implement model inference testing with image preprocessing using OpenCV`, `jpg로도 yolo 모델 작동 확인`)
- **온디바이스 추론 연동** — 앱의 `VisionCamera`/`YoloParser`/`NpuTfliteBridge` 등 추론 파이프라인 영역 기여
- **모바일 앱 환경 탐색·전환** — Flutter(flutter_vision) → React Native 환경 → 최종 Capacitor로 이어지는 모바일 런타임 의사결정 과정 참여, iOS 의존성(CocoaPods) 정리

→ **포트폴리오 핵심 정체성: "온디바이스 비전 AI 엔지니어 / 모바일 AI 연동 담당"**. 이 축으로 쓰면 커밋 근거와 100% 일치합니다.

---

# 포트폴리오 PPT 상세 구성 (12장)

## 1. 표지

**제목:** WalkMate (SafeStep) — 시각장애인을 위한 음성 기반 보행 내비게이션 & 온디바이스 위험 탐지 서비스

- 한 줄 소개: **스마트폰 카메라로 보행 장애물을 단말기 내부 AI(YOLO11→TFLite)로 실시간 탐지하고, 음성(STT/TTS)으로 목적지 입력·턴바이턴 안내·위험 신고까지 수행하는 보행 보조 앱**
- 팀: Team 3 (4인) / 본인 담당: **온디바이스 비전 AI · 모바일 AI 연동** (+ 모델 학습/평가)
- 핵심 기술: React 19, TypeScript, Vite, Capacitor 8, FastAPI, PostgreSQL(PostGIS), Supabase Realtime, AWS S3, Ultralytics YOLO11, TFLite, 커스텀 NPU 플러그인
- 저장소: `github.com/Evan-Yoon/cvProjectTeam3`

---

## 2. 문제 정의

**슬라이드 제목:** 시각장애인의 보행 안전을 "화면 없이" 해결하기

- 시각장애인은 보행 중 **볼라드, 방치된 킥보드, 현수막, 공사 구조물** 등 물리적 위험에 노출됨
- 기존 지도/내비 앱은 **화면 중심 UX**라 비시각적 사용이 어려움
- 위험 요소를 발견해도 **신고·수집·관리 체계가 분리**되어 데이터가 쌓이지 않음
- 그래서 필요한 3가지: **① 화면을 보지 않는 음성 조작 ② 실시간 장애물 탐지 ③ 신고→관리자 처리 루프**

> 발표 멘트: "단순 내비게이션이 아니라, 보행 중 마주치는 물리적 위험을 **단말기에서 즉시 인식하고 신고까지 연결**하는 서비스입니다."

---

## 3. 서비스 개요

**슬라이드 제목:** 사용자 앱 + 백엔드 + 관리자 대시보드로 구성된 보행 안전 플랫폼

| 구성 | 역할 | 코드 위치 |
| --- | --- | --- |
| 사용자 앱 | 음성 입력/안내, GPS, 카메라, **온디바이스 장애물 탐지**, 신고 | `UI/userUI` |
| 백엔드 | TMAP 경로 프록시, 신고 저장(S3+PostGIS), 관리자 API | `backend` |
| 관리자 대시보드 | 실시간 신고 모니터링, 통계, 히트맵, 상태 처리 | `UI/adminUI` |
| AI 모델 | YOLO11 학습 → TFLite 변환 → 앱 내장 | `model` |

핵심 기능: 음성 목적지 입력 → TMAP 보행자 경로 → 턴바이턴 TTS 안내 / 3초 주기 카메라 추론 → 위험 객체 음성 경고 + 자동 신고 / 관리자 실시간 확인·처리.

---

## 4. 시스템 아키텍처

**슬라이드 제목:** 모바일 앱 · AI · 백엔드 · 관리자 연동 구조

```
[사용자 앱  React+Capacitor]
  음성 STT/TTS · GPS watch · 카메라(react-webcam)
  └ 온디바이스 추론: NpuTflite(네이티브 플러그인) ← best_float32.tflite
        │ 신고(multipart: 이미지+위치+위험도)        │ 경로 요청
        ▼                                          ▼
[FastAPI 백엔드]                              [TMAP 보행자경로/POI API]
  ├ /navigation/path  (TMAP 프록시)
  ├ /reports/  POST   (이미지 S3 업로드 → PostGIS INSERT)
  └ /reports/  GET·PATCH·DELETE (관리자)
        │ 이미지                  │ 신고 레코드(geometry Point 4326)
        ▼                        ▼
   [AWS S3 public-read]     [PostgreSQL + PostGIS]
                                 │ 동일 DB를 Realtime로 노출
                                 ▼
                        [Supabase Realtime]
                                 │ postgres_changes(INSERT) 구독
                                 ▼
                 [관리자 대시보드 React+Tailwind+Recharts+Leaflet]
                   대시보드 · 히트맵 · 상태변경 · Nominatim 역지오코딩
```

강조 포인트(코드 근거):
- **AI 추론을 서버가 아닌 단말기에서 수행** → 네트워크 지연·프라이버시 위험 감소 (`NpuTfliteBridge.ts`, `VisionCamera.tsx`)
- **신고 이미지는 S3, 메타데이터는 PostGIS** 분리 (`backend/app/services/s3_uploader.py`, `crud/report.py`)
- 관리자 화면은 **백엔드가 쓴 동일 DB를 Supabase Realtime으로 구독** → 폴링 없이 즉시 반영 (`adminUI/App.tsx`)

---

## 5. 온디바이스 비전 AI 파이프라인 ★본인 핵심

**슬라이드 제목:** 카메라 프레임 → 전처리 → 추론 → 후처리 → 음성 경고 + 자동 신고

`UI/userUI/components/VisionCamera.tsx` + `src/utils/YoloParser.ts` + `NpuTfliteBridge.ts`

처리 흐름 (3초 주기 루프, 중첩 실행 방지 `isRunningRef`):
1. **캡처**: `react-webcam`(후면 카메라)에서 스크린샷
2. **레터박스 전처리**: 비율 유지하며 640×640 캔버스에 패딩(검은 여백) 합성 → 왜곡 없는 입력
3. **추론**: 커스텀 네이티브 플러그인 `NpuTflite.detect()` 호출 (NPU delegate, 미지원 시 CPU 폴백). 추론 시간(ms) 측정
4. **후처리(`YoloParser`)**: 다양한 출력 텐서 포맷 자동 판별 — `[1,N,6]` detection list, raw `[1,F,B]`/`[1,B,F]`(84/85 채널), objectness 유무 자동 처리, 픽셀↔정규화 좌표 자동 감지 후 **NMS(IoU)**로 중복 제거
5. **위협 객체 선정**: 화면 중앙(0.33~0.66) & 하단(바닥 y>0.66)에 가장 가까운 박스를 "주 장애물"로 결정
6. **거리/방향 추정**: 박스 크기비로 거리 추정(`1/max(w,h)`, 0.5~20m 클램프), x중심으로 좌(L)/정면(C)/우(R) 판정
7. **음성 경고**: 위험도 3은 5m 이내, 위험도 2는 3m 이내일 때만 TTS 경고(과경고 방지), 위험도 1은 생략
8. **자동 신고**: 위치+위험도+라벨+(박스 그려진)이미지를 `sendHazardReport()`로 백엔드 전송

라벨/위험도 매핑(코드): car·bus·truck·motorcycle·bicycle·kickboard = 위험도 3, person·dog·banner = 2, traffic light·bollard·stop sign·bench = 1.

> 발표 멘트: "단순히 모델을 호출한 게 아니라, **레터박스 전처리·텐서 포맷 자동 판별·NMS·위협도 기반 우선순위·거리/방향 추정**까지 추론 전후 파이프라인을 직접 설계했습니다."

---

## 6. 모델 학습 · 실험 · TFLite 변환 ★본인 핵심

**슬라이드 제목:** YOLO11n 학습 — 데이터 구성, 비교 실험, 온디바이스 배포

`model/total.ipynb`, `model/exp_comparison/`, `model/datasets/`

- **베이스/데이터**: `yolo11n.pt`에서 출발, COCO 일부 + Roboflow **볼라드(CC BY 4.0)** + **킥보드** 데이터셋을 병합(`coco_total`). 추론 라벨맵 13클래스(person…bollard…kickboard)
- **추가 실험**: 별도로 **점자블록(Braille block) OBB 탐지 모델**도 학습 (보도 환경 인식 확장 실험)
- **비교 실험(ablation, 각 20 epoch / imgsz 640)** — 실제 `results.csv` 기준:

| 실험 | optimizer/aug | Precision | Recall | mAP50 | mAP50-95 |
| --- | --- | --- | --- | --- | --- |
| **baseline** | auto, 기본 aug | **0.755** | **0.605** | **0.677** | **0.477** |
| heavy_aug | 강한 증강 | 0.749 | 0.592 | 0.664 | 0.462 |
| adamw_cos | AdamW+cosine | 0.741 | 0.604 | 0.665 | 0.464 |

  → **결론: 무거운 증강·AdamW가 항상 좋은 건 아니었고, 이 데이터 규모/에폭에서는 baseline이 최고.** (비교 그래프 `comparison_plot.png`)
- **배포**: 학습 모델을 **TFLite(`best_float32.tflite`)로 변환, 입력 720→앱 내장**, `public/wasm/`에 탑재해 단말기 추론

> 발표 포인트: 정확도 수치 자체보다 **"가설(증강/옵티마이저를 바꾸면 오를 것)을 실험으로 검증하고 baseline 채택"** 이라는 의사결정을 강조. (수치는 위 표가 실제값)

---

## 7. 음성 중심 사용자 흐름 (접근성 UX)

**슬라이드 제목:** 화면을 보지 않아도 되는 상태기반 음성 인터랙션

`UI/userUI/App.tsx`, `components/*Screen.tsx`, `src/utils/audio.ts`

- **5단계 상태머신**(`types.ts` `AppScreen`): `IDLE → LISTENING → (CONFIRMATION | RETRY) → GUIDING`
- **STT/TTS**: Capacitor Community 플러그인, `ko-KR`. TTS로 "어디로 가고 싶으신가요?" 안내 후 STT 시작, **1.3초 침묵 디바운스**로 자동 확정, 화면 어디나 터치로 수동 확정/취소 (`ListeningScreen.tsx`)
- **GuidingScreen 고급 처리**: TTS **우선순위 큐**(장애물 경고 우선), Haversine 거리·bearing 계산, **나침반+GPS 센서퓨전**으로 진행 방향 추정, **경로 이탈 감지**(쿨다운 경고), Leaflet 디버그 지도
- **실험 흔적(정직하게)**: `services/liveClient.ts`에 Gemini Live 실시간 음성 에이전트(function calling: proposeDestination/startNavigation 등) 구현 → 최종은 경량 STT/TTS로 확정

> 발표 멘트: "시각장애인을 1차 사용자로 가정해, **모든 흐름을 음성 피드백 중심의 상태머신**으로 설계하고 화면 의존도를 낮췄습니다."

---

## 8. 관리자 대시보드 (팀 기여 — 구조 설명)

**슬라이드 제목:** Supabase Realtime 기반 실시간 신고 모니터링

`UI/adminUI/App.tsx`, `views/`(Dashboard/Database/Heatmap/Settings), `components/`

- **실시간 수신**: `supabase.channel().on('postgres_changes', {event:'INSERT', table:'reports'})` 구독 → 새 신고 즉시 목록 prepend
- **초기 로딩**: Supabase에서 `status != 'hidden'` 정렬 조회 후 `mapToHazardData`로 화면 모델 변환(위험도 라벨/상태 정규화/좌표 파싱)
- **주소 보강**: 좌표를 **Nominatim 역지오코딩**으로 변환, 무료 API 차단 방지를 위해 **1초 간격 순차 호출**
- **시각화**: Recharts 통계 + Leaflet 히트맵, 행 클릭 시 위치로 히트맵 포커싱
- **상태 처리**: new/processing/done 변경, soft delete(`status='Hidden'`)
- DB 스키마(`Supabase/tables.sql`): **PostGIS 활성화**, `reports(item_id, location geometry(Point,4326), risk_level, image_url, status, created_at, distance, direction…)`, `supabase_realtime` publication 등록

> PPT 표기: 슬라이드 하단에 "**팀 협업 / 본인은 신고 데이터 스키마·연동 관점 참여**"처럼 기여 범위를 명확히.

---

## 9. 백엔드 · 데이터 저장 구조 (팀 기여 — 구조 설명)

**슬라이드 제목:** FastAPI + S3 + PostGIS — 이미지와 공간 데이터 분리 저장

`backend/app/`

- **경로(`/api/v1/navigation/path`)**: TMAP 보행자 경로 프록시. TMAP `features`에서 Point는 안내 step(`instruction`), LineString은 지도용 path 좌표로 분리 반환
- **신고(`POST /api/v1/reports/`)**: multipart 수신 → 타임스탬프+uuid 파일명 → **S3 업로드(public-read)** → `crud_report.create_report`가 **`ST_SetSRID(ST_MakePoint(lon,lat),4326)`로 PostGIS INSERT**
- **관리자 API**: 목록(페이지네이션)·`PATCH` 상태변경(new/processing/done)·`DELETE`(soft, status='Hidden'). 조회는 `ST_X/ST_Y`로 좌표 복원
- **스토리지 분리**: 큰 이미지 파일은 S3, 검색·집계 대상 메타데이터는 DB → 서버 디스크 의존 제거, 확장성 확보 (`s3_uploader.py`)
- **스택**: FastAPI, SQLAlchemy(raw SQL `text()`), boto3, psycopg2, python-multipart

> 발표 멘트: "이미지는 S3, **위치는 PostGIS geometry**로 분리해 공간 쿼리와 확장성을 동시에 확보했습니다."

---

## 10. 개발 환경 · 협업

**슬라이드 제목:** Docker Compose 개발환경 표준화 + 기능/담당자별 브랜치 전략

- **DevContainer + Docker Compose**(`.devcontainer/`)로 환경 통일: `workspace`(Python 3.10 + Node 20 + JDK17, Capacitor/Android 빌드 대비) + **`postgis/postgis:15` + `redis:7`** 컨테이너를 한 번에 기동, `postCreateCommand`로 백엔드/프론트 의존성 자동 설치 → 신규 합류 시 세팅 비용 감소 *(※ 프로덕션 배포용 compose·CI 자동배포는 없음 — "자동 배포"로 쓰지 않기)*
- **브랜치 전략**: `main` + 기능/담당자 브랜치(`choihyunseok`, `yoonjihyun`, `leejiho`, `Dev` 등) → PR 병합, `feat:`/`fix:`/`docs:`/`chore:` prefix
- **역할 분리 구조**: 사용자 앱 / 관리자 / 백엔드 / 모델 디렉토리 분리 → **API·신고 데이터 스키마를 인터페이스 계약으로** 프론트·백엔드 조율
- 본인 협업 포인트: **모델 출력 텐서 포맷 ↔ 앱 후처리(YoloParser)** , **신고 페이로드(필드명·multipart `file` 키) ↔ 백엔드** 정합 맞추기

---

## 11. 기술적 문제 해결 사례 ★가장 중요

각 사례는 **어려움 → 원인 → 해결 → 결과** 구조. (본인 기여 중심 1·2, 팀 연동 3)

**사례 1 — 학습 모델과 모바일 런타임의 모델 포맷 불일치**
- 문제: PyTorch 학습 모델을 모바일에서 그대로 못 돌림
- 원인: 학습(파이토치)과 단말 추론(모바일 런타임)의 모델 형식·입력 규격이 다름
- 해결: **TFLite(`best_float32`)로 변환 + 입력 크기(720) 튜닝**, JS↔네이티브를 잇는 **커스텀 Capacitor 플러그인 `NpuTflite`** 로 로드/추론 브리지 설계(NPU delegate, CPU 폴백)
- 결과: **서버 추론 없이 단말기에서 실시간 장애물 탐지** 달성

**사례 2 — 가변적인 YOLO 출력 텐서 후처리**
- 문제: 변환/런타임에 따라 출력 텐서 shape·좌표계가 제각각이라 박스 파싱 실패
- 원인: `[1,N,6]` vs raw `[1,F,B]/[1,B,F]`, objectness 유무, 픽셀/정규화 좌표 혼재
- 해결: `YoloParser`에서 **shape 자동 추론 + 좌표계 자동 정규화 + NMS** 구현, 더해 **중앙·하단 최근접 객체 우선순위와 거리/방향 추정** 로직 추가
- 결과: 다양한 모델 산출물에도 **안정적으로 위협 객체를 선별·경고**

**사례 3 — 관리자 실시간성 (팀 연동)**
- 문제: 새 신고를 즉시 확인하려면 잦은 새로고침/폴링 필요
- 원인: REST 조회만으로 실시간성 부족
- 해결: 백엔드가 저장하는 **동일 PostgreSQL을 Supabase Realtime으로 노출**, 대시보드가 `reports` INSERT 이벤트 구독
- 결과: 폴링 없이 **실시간 신고 모니터링** 구현

---

## 12. 성과 · 배운 점 · 마무리

**슬라이드 제목:** 온디바이스 비전 AI를 실제 서비스 흐름에 연결한 경험

- **만든 것**: 음성 UX → 온디바이스 YOLO11 탐지 → 위험 신고(S3+PostGIS) → 관리자 실시간 모니터링까지 동작하는 풀스택 보행 보조 서비스
- **본인 핵심 역량**: 모델 학습/비교실험·TFLite 변환·**추론 전후 파이프라인 설계**·네이티브 추론 플러그인 연동 (온디바이스 비전 AI / 모바일 AI 연동)
- **배운 점**: 학습 정확도뿐 아니라 **전처리·후처리·실행 환경(런타임)·과경고 방지 UX** 까지 맞춰야 "쓸 수 있는 AI"가 된다는 것
- **직무 적합성**: 모델부터 단말 적용·서비스 연동까지 end-to-end로 다룬 경험

---

# 부록 A. 최종 PPT 흐름 요약

| 장 | 제목 | 핵심 메시지 | 본인 기여 강도 |
| -: | --- | --- | --- |
| 1 | 표지 | 프로젝트 정체성 | — |
| 2 | 문제 정의 | 화면 없이 보행 안전 | — |
| 3 | 서비스 개요 | 앱+백엔드+관리자 | — |
| 4 | 아키텍처 | 전체 연동 구조 | ○ |
| 5 | 온디바이스 비전 파이프라인 | 전처리~경고~신고 | ★ |
| 6 | 모델 학습/실험/TFLite | YOLO11 ablation·변환 | ★ |
| 7 | 음성 UX | 상태기반 음성 인터랙션 | ○ |
| 8 | 관리자 대시보드 | Supabase 실시간 | △(팀) |
| 9 | 백엔드/저장구조 | S3+PostGIS 분리 | △(팀) |
| 10 | 환경/협업 | DevContainer·브랜치 | ○ |
| 11 | 문제 해결 | 포맷불일치·후처리·실시간 | ★ |
| 12 | 성과/마무리 | end-to-end AI 연동 | ★ |

★=본인 주도, ○=기여 있음, △=팀 주도(구조 설명).

# 부록 B. PPT에 쓰면 위험한 표현 (재확인)

쓰지 말 것: "React Native iOS 앱", "Next.js 사용", "TensorFlow.js로 추론"(실제는 네이티브 TFLite 플러그인), "S3 정적 호스팅", "Docker Compose 자동 배포", "CI/CD 배포 주기 단축", "코드 품질/린트 개선"(근거 없음).
근거 있는 표현으로 대체: 위 5·6·11장 및 정정표 참고.

# 부록 C. 슬라이드 제작 시 첨부하면 좋은 캡처

- `model/exp_comparison/comparison_plot.png`, 각 실험의 `results.png`/`confusion_matrix.png`/`BoxPR_curve.png`
- `model/exp_comparison/*/val_batch*_pred.jpg` (실제 탐지 예측 이미지)
- 앱 화면 캡처(IDLE/LISTENING/GUIDING), 관리자 대시보드/히트맵 화면
- 아키텍처 다이어그램(본 문서 4장 도식 기반으로 재작도)

# WalkMate Admin UI

WalkMate `adminUI`는 사용자 앱에서 접수된 위험 신고를 운영자가 확인하고 관리하기 위한 관리자 대시보드입니다. React + Vite 기반 웹앱이며, Supabase `reports` 테이블을 조회하고 Realtime INSERT 이벤트를 구독해 새 신고를 실시간으로 반영합니다.

## 주요 기능

- 신고 현황 대시보드
- 위험도별 통계 차트
- 시간대별 신고량 차트
- 최근 신고 목록 확인
- 지도 기반 위험 위치 히트맵
- 전체 신고 데이터베이스 조회
- 상태/위험도/날짜 필터
- CSV 내보내기
- 신고 상세 이미지와 위치 정보 확인
- 신고 상태 변경
- 선택 신고 삭제 또는 숨김 처리

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| UI | React 19, Vite |
| 스타일 | Tailwind CSS 4, PostCSS, Autoprefixer |
| DB/Realtime | Supabase JS |
| 차트 | Recharts |
| 지도 | Leaflet, React Leaflet |
| 아이콘 | lucide-react |
| API 통신 | fetch |

## 주요 파일 구조

```text
UI/adminUI/
├── App.tsx
├── index.tsx
├── index.html
├── index.css
├── types.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── postcss.config.js
├── tailwind.config.js
├── .env.example
├── Supabase/
│   └── tables.sql
├── components/
│   ├── Sidebar.tsx
│   ├── HazardTable.tsx
│   ├── HazardModal.tsx
│   └── ActionReportModal.tsx
├── views/
│   ├── Dashboard.tsx
│   ├── Heatmap.tsx
│   └── Database.tsx
└── src/
    └── api/
        └── adminApi.ts
```

## 환경 변수

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cd UI/adminUI
cp .env.example .env
```

필요한 값:

```text
VITE_SUPABASE_URL=https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/
VITE_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY_HERE]
VITE_BACKEND_URL=http://localhost:8000
```

각 값의 역할:

| 환경 변수 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | 브라우저에서 사용하는 Supabase anon key |
| `VITE_BACKEND_URL` | FastAPI 백엔드 주소 |

로컬 네트워크에서 다른 기기로 접속하거나 백엔드가 다른 장비에서 실행 중이면 `VITE_BACKEND_URL`을 해당 IP로 바꿉니다.

```text
VITE_BACKEND_URL=http://<BACKEND_HOST>:8000
```

## Supabase 테이블 생성

Supabase SQL Editor에서 다음 파일 내용을 실행합니다.

```text
UI/adminUI/Supabase/tables.sql
```

이 SQL은 다음 작업을 수행합니다.

- PostGIS 확장 활성화
- `public.reports` 테이블 생성
- 로컬 테스트용 RLS 비활성화
- `reports` 테이블 Realtime publication 등록

`reports` 테이블 주요 컬럼:

| 컬럼 | 역할 |
|---|---|
| `item_id` | 신고 고유 ID |
| `created_at` | 신고 생성 시각 |
| `device_id` | 신고 기기 ID |
| `hazard_type` | 위험 객체/상황 종류 |
| `risk_level` | 숫자 위험도 |
| `image_url` | 신고 이미지 경로 또는 URL |
| `description` | 신고 상세 설명 |
| `label` | AI 모델 감지 라벨 |
| `status` | 처리 상태 |
| `distance` | 거리 추정값 |
| `direction` | `L`, `R`, `C` 방향 코드 |
| `location` | PostGIS Point 좌표 |
| `latitude`, `longitude` | 별도 위도/경도 |
| `deleted_at` | 삭제/숨김 시간 기록용 |

주의: `tables.sql`은 로컬 테스트 편의를 위해 RLS를 비활성화합니다. 운영 환경에서는 관리자 인증과 RLS 정책을 별도로 설계해야 합니다.

## 로컬 실행

```bash
cd UI/adminUI
npm install
npm run dev
```

Vite 설정상 개발 서버는 다음 주소로 열립니다.

```text
http://localhost:3000
```

같은 네트워크의 다른 기기에서 접근하려면:

```text
http://<MAC_LOCAL_IP>:3000
```

## 빌드

```bash
cd UI/adminUI
npm run build
```

빌드 결과는 `dist/`에 생성됩니다.

미리보기:

```bash
npm run preview
```

현재 빌드에서는 번들 크기가 500KB를 넘는다는 Vite 경고가 나올 수 있습니다. 이는 Recharts, Leaflet, Supabase 등 대시보드 의존성이 포함되기 때문이며, 빌드 실패는 아닙니다.

## 화면 구성

### Dashboard

`views/Dashboard.tsx`

- 오늘 접수된 신고 수
- 처리 대기 중 신고 수
- 해결 완료 신고 수
- 전체 누적 신고 수
- 위험 레벨 분포 차트
- 시간대별 접수 횟수 차트
- 최근 접수 내역

### Heatmap

`views/Heatmap.tsx`

- 신고 위치 지도 표시
- 위험도별 색상 표시
- 위험 등급 필터
- 현재 위치로 지도 이동
- 상세 모달에서 특정 신고 위치로 이동

### Database

`views/Database.tsx`

- 전체 신고 목록 조회
- 상태 필터
- 위험도 필터
- 날짜 필터
- 최신순/과거순 정렬
- 페이지네이션
- CSV 다운로드
- 선택 항목 삭제/숨김 처리

### HazardModal

`components/HazardModal.tsx`

- 신고 이미지
- 위험도
- 신고 ID
- 위험 유형
- 위치와 거리/방향
- 발생 시간
- 근접 주소
- 신고자/감지기
- 조치 보고서 작성
- 위치 지도 보기

### ActionReportModal

`components/ActionReportModal.tsx`

- 신고 상태를 `New`, `Processing`, `Done` 중 하나로 변경
- 변경 사유 입력 UI 제공
- 현재 API 호출은 status만 전송

## 데이터 흐름

```text
userUI
  -> FastAPI /api/v1/reports/
  -> Supabase reports table
  -> adminUI Supabase select + Realtime INSERT 구독
  -> Dashboard / Heatmap / Database 표시
```

상태 변경과 삭제/숨김 처리는 `src/api/adminApi.ts`를 통해 FastAPI 백엔드로 요청합니다.

```text
PATCH  {VITE_BACKEND_URL}/api/v1/reports/{itemId}?status={status}
DELETE {VITE_BACKEND_URL}/api/v1/reports/{itemId}
```

초기 목록 조회와 실시간 신규 신고 반영은 Supabase 직접 접근을 사용합니다.

## 자주 발생하는 문제

### 데이터가 보이지 않음

확인할 항목:

- `.env`의 `VITE_SUPABASE_URL`
- `.env`의 `VITE_SUPABASE_ANON_KEY`
- Supabase에 `reports` 테이블이 생성되어 있는지
- `status`가 `hidden`인 데이터만 있는지
- 브라우저 개발자 도구의 Supabase 요청 오류

### 실시간 신규 신고가 안 들어옴

확인할 항목:

- `tables.sql`의 `alter publication supabase_realtime add table public.reports;` 실행 여부
- Supabase Realtime 설정에서 `reports` 테이블 활성화 여부
- 신규 데이터가 INSERT인지, UPDATE인지

현재 adminUI는 INSERT 이벤트만 구독합니다. 기존 신고의 status 변경이나 hidden 처리는 자동 구독 대상이 아닙니다.

### 이미지가 깨짐

`image_url`이 전체 URL이면 그대로 사용하고, 상대 경로면 `VITE_BACKEND_URL`을 앞에 붙입니다. 이미지가 깨질 경우 다음을 확인합니다.

- `image_url` 값이 실제 접근 가능한지
- 백엔드 정적 파일 또는 S3 URL이 열리는지
- `VITE_BACKEND_URL`이 올바른지

### 상태 변경 실패

확인할 항목:

- FastAPI 백엔드가 실행 중인지
- `VITE_BACKEND_URL`이 백엔드 주소와 맞는지
- `PATCH /api/v1/reports/{itemId}?status={status}` API가 구현되어 있는지
- CORS 또는 ngrok 경고 우회 문제가 없는지

### 지도 배경이 안 보임

Heatmap은 외부 지도 tile 서버에 의존합니다. 네트워크가 막혀 있거나 tile 서버 접근이 실패하면 신고 marker는 있어도 지도 배경이 보이지 않을 수 있습니다.

## 운영 전 보완 필요 사항

- 관리자 로그인/로그아웃 구현
- Supabase RLS 정책 재설계
- 상태 변경 사유 저장
- UPDATE/DELETE Realtime 구독 추가
- `risk_level` 정책을 userUI/backend와 통일
- 좌표를 문자열이 아닌 `lat`, `lng` 숫자 필드로 관리
- reverse geocoding 결과 캐싱

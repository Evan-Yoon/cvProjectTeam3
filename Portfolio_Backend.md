# Portfolio Backend

## 1. 프로젝트 개요

WalkMate는 시각장애인 보행 보조를 목표로 한 서비스입니다. 백엔드는 사용자 앱에서 감지한 위험 지점 신고를 저장하고, 관리자 화면에서 신고 데이터를 조회/상태 변경할 수 있게 하며, TMAP 보행자 경로 API를 중계했습니다. 근거: `backend/app/main.py`, `UI/userUI/src/api/report.ts`, `UI/userUI/src/api/backend.ts`, `UI/adminUI/src/api/adminApi.ts`

현재 레포 기준 Backend 구현 근거는 `backend`입니다. 이 폴더는 FastAPI, SQLAlchemy, PostgreSQL/PostGIS raw SQL, S3 업로드, TMAP 경로 중계 구조를 포함합니다. 근거: `backend/requirements.txt`, `backend/app/core/database.py`, `backend/app/crud/report.py`, `backend/app/services/s3_uploader.py`

## 2. Backend 역할

백엔드는 세 가지 역할을 수행했습니다.

- 사용자 앱의 AI 카메라 신고를 multipart form으로 받아 이미지와 메타데이터를 저장했습니다. 근거: `UI/userUI/src/api/report.ts`, `backend/app/api/v1/endpoints/reports.py`
- 관리자 앱에서 신고 목록 조회, 상태 변경, 숨김 처리를 수행할 수 있는 API를 제공했습니다. 근거: `backend/app/api/v1/endpoints/admin.py`
- 사용자 앱의 길찾기 요청을 TMAP 보행자 경로 API로 전달하고, 프론트엔드가 사용할 `steps`와 `path` 구조로 반환했습니다. 근거: `UI/userUI/src/api/backend.ts`, `backend/app/api/v1/endpoints/navigation.py`

## 3. API 설계

| Method | Endpoint | 목적 | Request | Response | 근거 |
|---|---|---|---|---|---|
| GET | `/health` | 서버 상태 확인 | 없음 | `{"ok": true}` | `backend/app/main.py` |
| POST | `/api/v1/reports/` | 위험 신고 생성 | `item_id`, `user_id`, `latitude`, `longitude`, `hazard_type`, `risk_level`, `description`, `file` | `status`, `message`, `data` | `backend/app/api/v1/endpoints/reports.py` |
| GET | `/api/v1/reports/` | 관리자 신고 목록 조회 | `skip`, `limit` query | `total`, `data` | `backend/app/api/v1/endpoints/admin.py` |
| PATCH | `/api/v1/reports/{item_id}` | 신고 상태 변경 | `status=new|processing|done` query | `success`, `data` | `backend/app/api/v1/endpoints/admin.py` |
| DELETE | `/api/v1/reports/{item_id}` | 신고 숨김 처리 | path `item_id` | `success`, `message`, `data` | `backend/app/api/v1/endpoints/admin.py` |
| POST | `/api/v1/navigation/path` | 보행 경로 요청 | `start_lat`, `start_lon`, `end_lat`, `end_lon` JSON | `status`, `data`, `path` | `backend/app/api/v1/endpoints/navigation.py` |

신고 생성 API는 이미지 파일과 텍스트 필드를 함께 받기 위해 `UploadFile`, `File`, `Form`, `python-multipart`를 사용했습니다. 근거: `backend/requirements.txt`, `backend/app/api/v1/endpoints/reports.py`

경로 API는 TMAP 응답의 `Point`를 안내 단계로, `LineString`을 지도 polyline용 좌표 배열로 변환했습니다. 근거: `backend/app/api/v1/endpoints/navigation.py`

## 4. 데이터 구조

DB 저장은 `public.reports` 테이블을 기준으로 raw SQL로 구현했습니다. 신고 생성 시 `item_id`, `location`, `device_id`, `hazard_type`, `risk_level`, `image_url`, `description`을 insert했습니다. 위치는 위도/경도를 그대로 저장하지 않고 `ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)`로 저장했습니다. 근거: `backend/app/crud/report.py`

관리자 목록 조회는 `ST_Y(location) as latitude`, `ST_X(location) as longitude`로 좌표를 반환했습니다. 근거: `backend/app/crud/report.py`

공통 Pydantic schema 파일은 비어 있습니다. 현재 request schema는 endpoint 함수 signature와 `NavigationRequest` 모델에 분산되어 있습니다. 근거: `backend/app/models/schemas.py`, `backend/app/api/v1/endpoints/navigation.py`

DB schema 생성 SQL, index, PostGIS extension 설정은 확인되지 않았습니다. `[확인 필요: DB schema 원본 및 PostGIS 설정]`

## 5. 서버 아키텍처

백엔드는 다음 계층으로 구성했습니다.

| 계층 | 역할 | 근거 |
|---|---|---|
| `app/main.py` | FastAPI 앱 생성, CORS, static mount, router 등록 | `backend/app/main.py` |
| `api/v1/endpoints` | HTTP endpoint 처리 | `backend/app/api/v1/endpoints/*.py` |
| `services` | S3 업로드 같은 외부 연동 | `backend/app/services/s3_uploader.py` |
| `crud` | DB raw SQL 처리 | `backend/app/crud/report.py` |
| `core` | 환경변수와 DB session 설정 | `backend/app/core/config.py`, `backend/app/core/database.py` |

`main.py`는 `/api/v1/reports`, `/api/v1`, `/api/v1/navigation/path` 라우터를 등록했습니다. 근거: `backend/app/main.py`

## 6. 핵심 구현

### 신고 업로드

사용자 앱은 AI 카메라가 만든 JPEG base64 이미지를 Blob으로 변환하고, UUID 기반 `item_id`, `user_id`, 위치, 위험 유형, 위험도, 설명을 FormData로 구성했습니다. 근거: `UI/userUI/src/api/report.ts`

백엔드는 업로드 파일을 읽어 S3에 저장하고, 반환된 image URL을 DB에 저장했습니다. S3 key는 timestamp와 UUID 일부를 조합해 생성했습니다. 근거: `backend/app/api/v1/endpoints/reports.py`, `backend/app/services/s3_uploader.py`

### 공간 좌표 저장

신고 위치는 PostGIS point로 저장했습니다. 이 구조는 관리자 지도/공간 조회 확장을 고려한 데이터 표현입니다. 근거: `backend/app/crud/report.py`

### 관리자 상태 관리

관리자 API는 상태를 `new`, `processing`, `done`으로 제한했습니다. 허용되지 않은 status는 400으로 거부하고, 대상 row가 없으면 404를 반환했습니다. 근거: `backend/app/api/v1/endpoints/admin.py`

삭제는 row 삭제가 아니라 `status = 'Hidden'`으로 바꾸는 숨김 처리로 구현했습니다. 근거: `backend/app/api/v1/endpoints/admin.py`, `backend/app/crud/report.py`

### 경로 중계

경로 API는 출발지/목적지 좌표를 받아 TMAP 보행자 경로 API에 전달했습니다. 응답에서 안내 문구와 좌표를 분리해 사용자 앱이 음성 안내와 지도 polyline에 사용할 수 있는 구조로 반환했습니다. 근거: `backend/app/api/v1/endpoints/navigation.py`, `UI/userUI/src/api/backend.ts`

## 7. 예외 처리

- `DATABASE_URL`이 없으면 RuntimeError를 발생시켜 잘못된 DB 설정을 빠르게 드러냈습니다. 근거: `backend/app/core/database.py`
- S3 bucket 설정이 없으면 신고 생성을 500 오류로 중단했습니다. 근거: `backend/app/api/v1/endpoints/reports.py`
- S3 업로드 실패는 500 `S3 Upload Failed`로 반환했습니다. 근거: `backend/app/api/v1/endpoints/reports.py`
- DB insert/update/delete 실패 시 rollback 후 예외를 다시 발생시켰습니다. 근거: `backend/app/crud/report.py`
- TMAP 경로 API가 200이 아니면 `status: error` 응답을 반환했습니다. 근거: `backend/app/api/v1/endpoints/navigation.py`

## 8. 보안/설정 관리

환경변수는 `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `VITE_BACKEND_URL` 형태로 템플릿화되어 있습니다. 근거: `.env.example`


TMAP API key는 프론트엔드와 백엔드 코드에 직접 들어 있습니다. 이 항목은 성과가 아니라 보안 개선 필요 항목으로 다루는 것이 안전합니다. 근거: `UI/userUI/src/api/tmap.ts`, `backend/app/api/v1/endpoints/navigation.py`

인증/인가 API, token 검증 dependency, role 기반 접근 제어 코드는 확인되지 않았습니다. `[확인 필요: 인증/인가 구현 여부]`

## 9. 실행/배포

백엔드는 다음 entrypoint로 실행되도록 구성했습니다.

| 실행 대상 | 근거 |
|---|---|
| FastAPI/Uvicorn `0.0.0.0:8000` | `backend/run.py` |
| Python 3.10 + Node.js 20 + OpenJDK 17 개발 컨테이너 | `.devcontainer/Dockerfile` |
| PostgreSQL, Redis 개발 컨테이너 | `.devcontainer/docker-compose.yml` |

배포 URL, 배포 플랫폼 설정, CI/CD 설정 파일은 확인되지 않았습니다. `[확인 필요: 배포 URL 또는 배포 설정 필요]`

FastAPI docs는 비활성화 설정이 없지만 실제 `/docs` 접근 여부는 실행 확인이 필요합니다. 근거: `backend/app/main.py`

## 10. 트러블슈팅

### multipart 이미지 업로드

이미지와 위치/위험도 값을 한 번에 전송해야 했기 때문에 사용자 앱에서는 base64 이미지를 Blob으로 변환하고, 백엔드에서는 `UploadFile`, `File`, `Form`으로 받도록 구성했습니다. 근거: `UI/userUI/src/api/report.ts`, `backend/app/api/v1/endpoints/reports.py`

### 실행 의존성 정리

경로 API는 `requests`를 사용하지만 `requirements.txt`에는 `requests`가 없습니다. 배포 또는 신규 환경 실행 전 의존성 파일 정비가 필요합니다. 근거: `backend/app/api/v1/endpoints/navigation.py`, `backend/requirements.txt`

## 11. 한계와 개선점

- DB schema, index, PostGIS extension 생성 근거가 부족합니다. `[확인 필요: DB schema 원본]`
- 인증/인가 구현 근거가 없습니다. `[확인 필요: 관리자 접근 제어 방식]`
- 관리자 앱의 Supabase 직접 조회와 백엔드 PostgreSQL 연결이 같은 DB를 바라보는지 확인해야 합니다. 근거: `UI/adminUI/App.tsx`, `backend/app/core/database.py`
- 배포 링크와 운영 로그가 없어 운영 상태를 확정할 수 없습니다. `[확인 필요: 배포 URL 및 운영 환경]`

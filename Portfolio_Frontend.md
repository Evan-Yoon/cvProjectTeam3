# Portfolio Frontend

## 1. 프로젝트 개요

WalkMate 프론트엔드는 사용자 보행 보조 앱과 관리자 관제 대시보드로 구성했습니다. 사용자 앱은 음성 기반 목적지 입력, GPS 위치 추적, TMAP 장소 검색/경로 요청, 카메라 기반 위험 객체 감지, TTS 안내를 담당했습니다. 관리자 앱은 신고 데이터를 조회하고, 위험도/시간대 통계와 지도 기반 위험 분포를 시각화했습니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/components/VisionCamera.tsx`, `UI/adminUI/App.tsx`, `UI/adminUI/views/Dashboard.tsx`, `UI/adminUI/views/Heatmap.tsx`

현재 프론트엔드 구현 근거는 `UI/userUI`와 `UI/adminUI`입니다. 근거: `UI/userUI/package.json`, `UI/adminUI/package.json`

## 2. 사용자 흐름

사용자 앱은 React state로 화면을 전환했습니다.

| 단계 | 구현 내용 | 근거 |
|---|---|---|
| Idle | 시작 화면과 위치 준비 상태 표시 | `UI/userUI/App.tsx`, `UI/userUI/components/IdleScreen.tsx` |
| Listening | 음성 인식으로 목적지 입력 | `UI/userUI/App.tsx`, `UI/userUI/components/ListeningScreen.tsx` |
| Retry | 장소 검색/네트워크 실패 시 재시도 | `UI/userUI/App.tsx`, `UI/userUI/components/RetryScreen.tsx` |
| Confirmation | TMAP POI 검색 결과 확인 | `UI/userUI/App.tsx`, `UI/userUI/components/ConfirmationScreen.tsx` |
| Guiding | 경로 안내, GPS 추적, 장애물 TTS 경고 | `UI/userUI/App.tsx`, `UI/userUI/components/GuidingScreen.tsx` |

앱 시작 시 GPS 권한을 확인하고 `Geolocation.watchPosition`으로 현재 위치를 갱신했습니다. 목적지 음성 입력 후 TMAP POI 검색을 수행하고, 목적지 확인 후 백엔드 경로 API를 호출했습니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/src/api/tmap.ts`, `UI/userUI/src/api/backend.ts`

## 3. 주요 화면 구성

### 사용자 앱

- `IdleScreen`: 앱 시작과 위치 준비 상태를 표시했습니다. 근거: `UI/userUI/components/IdleScreen.tsx`
- `ListeningScreen`: STT 기반 목적지 입력 흐름을 담당했습니다. 근거: `UI/userUI/components/ListeningScreen.tsx`, `UI/userUI/src/utils/audio.ts`
- `ConfirmationScreen`: 검색된 목적지를 확인했습니다. 근거: `UI/userUI/components/ConfirmationScreen.tsx`
- `GuidingScreen`: 경로 안내, 지도, 현재 위치, 경로 이탈 판단, 종료 음성 명령을 처리했습니다. 근거: `UI/userUI/components/GuidingScreen.tsx`
- `VisionCamera`: webcam frame을 TFLite 모델에 넣고 위험 객체를 감지한 뒤 신고를 전송했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

### 관리자 앱

- `Dashboard`: 오늘 신고 수, 처리 대기 수, 완료 수, 누적 데이터, 위험 레벨 분포, 시간대별 접수 횟수를 보여줬습니다. 근거: `UI/adminUI/views/Dashboard.tsx`
- `Heatmap`: Leaflet 지도 위에 위험 데이터를 CircleMarker로 표시하고 위험도 필터를 제공했습니다. 근거: `UI/adminUI/views/Heatmap.tsx`
- `Database`: 신고 데이터를 필터링, 정렬, 페이지네이션, CSV export, batch delete로 관리했습니다. 근거: `UI/adminUI/views/Database.tsx`
- `ActionReportModal`: 신고 상태를 `new`, `processing`, `done`으로 변경했습니다. 근거: `UI/adminUI/components/ActionReportModal.tsx`

화면 캡처 파일은 확인되지 않았습니다. `[확인 필요: 실제 실행 화면 캡처 필요]`

## 4. 컴포넌트 구조

사용자 앱은 화면 단위 component와 API/util 모듈을 분리했습니다.

| 영역 | 파일 | 역할 |
|---|---|---|
| 앱 상태 | `UI/userUI/App.tsx` | 화면 전환, GPS, 목적지/경로 state |
| 화면 | `UI/userUI/components/*.tsx` | Idle/Listening/Retry/Confirmation/Guiding/Camera |
| API | `UI/userUI/src/api/*.ts` | TMAP, backend navigation, report upload |
| AI bridge | `UI/userUI/NpuTfliteBridge.ts` | Capacitor native plugin 등록 |
| AI parser | `UI/userUI/src/utils/YoloParser.ts` | YOLO output 후처리 |

관리자 앱은 view, component, API helper, type을 분리했습니다.

| 영역 | 파일 | 역할 |
|---|---|---|
| 앱 상태 | `UI/adminUI/App.tsx` | page state, Supabase fetch/realtime |
| View | `UI/adminUI/views/*.tsx` | Dashboard/Heatmap/Database/Settings |
| Component | `UI/adminUI/components/*.tsx` | Sidebar/Table/Modal |
| API helper | `UI/adminUI/src/api/adminApi.ts` | 백엔드 report API 호출 |
| Type | `UI/adminUI/types.ts` | `HazardData` 구조 |

## 5. 상태 관리

사용자 앱은 전역 상태 라이브러리 없이 React `useState`, `useEffect`로 상태를 관리했습니다. `currentScreen`, `myLocation`, `destination`, `routeData`, `routePath`가 주요 상태입니다. 근거: `UI/userUI/App.tsx`

`GuidingScreen`은 GPS watch와 compass heading을 사용해 이동 상태를 관리하고, 다음 checkpoint 접근, 경로 이탈, 종료 명령, 장애물 TTS queue를 처리했습니다. 근거: `UI/userUI/components/GuidingScreen.tsx`

관리자 앱은 `activePage`, `selectedHazard`, `reports`, `isDarkMode`, `heatmapFocus`, `isSidebarOpen`을 state로 관리했습니다. 근거: `UI/adminUI/App.tsx`

Redux, Zustand, React Query 사용 근거는 확인되지 않았습니다.

## 6. API 연동

### 사용자 앱

사용자 앱은 `.env`의 `VITE_BACKEND_URL`을 우선 사용하고, 없으면 내부 IP 기반 기본 URL을 사용했습니다. 근거: `UI/userUI/src/api/report.ts`, `UI/userUI/src/api/backend.ts`

신고 업로드는 `fetch`로 `/api/v1/reports/`에 FormData를 전송했습니다. FormData에는 UUID, 위치, 위험 유형, 위험도, 설명, 이미지 파일이 포함됩니다. 근거: `UI/userUI/src/api/report.ts`

경로 요청은 `CapacitorHttp.post`로 `/api/v1/navigation/path/`에 출발지/목적지 좌표를 전송했습니다. 응답의 `data`는 음성 안내 단계, `path`는 지도 polyline 좌표로 사용했습니다. 근거: `UI/userUI/src/api/backend.ts`, `UI/userUI/App.tsx`

TMAP POI 검색과 reverse geocoding은 `CapacitorHttp`로 호출했습니다. 근거: `UI/userUI/src/api/tmap.ts`

### 관리자 앱

관리자 앱은 Supabase JS로 `reports` table을 조회하고 `postgres_changes` INSERT를 구독했습니다. 근거: `UI/adminUI/App.tsx`

상태 변경은 `patchReportStatus` helper가 백엔드 `/api/v1/reports/{item_id}?status=...`를 호출했습니다. 근거: `UI/adminUI/src/api/adminApi.ts`, `UI/adminUI/components/ActionReportModal.tsx`

## 7. UI/UX 처리

사용자 앱은 음성 중심 UX를 구현했습니다. GPS 권한이 없거나 위치를 가져오지 못하면 TTS로 안내하고, 검색 실패 또는 경로 요청 실패 시 Retry 화면으로 이동했습니다. 근거: `UI/userUI/App.tsx`

`GuidingScreen`은 경로 안내 중 현재 위치와 경로 데이터를 이용해 다음 안내 지점 도착 여부, 경로 이탈 경고, 종료 명령을 처리했습니다. 근거: `UI/userUI/components/GuidingScreen.tsx`

AI 카메라는 모델 로딩, 추론 시간, 객체 개수, 선택된 target 정보를 overlay로 표시했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

관리자 앱은 dark mode, sidebar, modal, 위험도 필터, 지도 필터, CSV export, batch selection을 제공합니다. 근거: `UI/adminUI/App.tsx`, `UI/adminUI/views/Database.tsx`, `UI/adminUI/views/Heatmap.tsx`

## 8. 핵심 구현

### 음성 기반 목적지 검색

사용자 음성 transcript에서 안내 요청 표현을 제거하고 keyword를 만든 뒤 TMAP POI 검색을 수행했습니다. 검색 결과가 있으면 확인 화면으로 이동하고, 실패하면 Retry 화면으로 이동했습니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/src/api/tmap.ts`

### 백엔드 경로 연동

목적지 확인 후 현재 GPS와 목적지 좌표를 백엔드로 보내 경로를 요청했습니다. 백엔드 응답에서 안내 단계와 지도 path를 분리해 `GuidingScreen`에 넘겼습니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/src/api/backend.ts`

### 카메라 AI 신고

`VisionCamera`는 3초마다 webcam screenshot을 640x640 canvas로 전처리하고, TFLite native plugin으로 추론했습니다. `YoloParser`로 box를 후처리한 뒤 primary hazard를 선택하고, 위치와 이미지, 위험도를 신고 API로 전송했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/NpuTfliteBridge.ts`, `UI/userUI/src/utils/YoloParser.ts`, `UI/userUI/src/api/report.ts`

### 관리자 실시간 대시보드

관리자 앱은 Supabase table 조회와 realtime INSERT 구독으로 신고 데이터를 화면에 반영했습니다. Dashboard는 위험 레벨과 시간대별 통계를 Recharts로 시각화하고, Heatmap은 Leaflet 지도에 위험 데이터를 표시했습니다. 근거: `UI/adminUI/App.tsx`, `UI/adminUI/views/Dashboard.tsx`, `UI/adminUI/views/Heatmap.tsx`

## 9. 트러블슈팅

### 백엔드 주소 전환

사용자 앱과 관리자 API helper는 `VITE_BACKEND_URL`을 우선 사용하고 fallback URL을 두었습니다. 경로 요청 실패 시 현재 backend URL과 error detail을 alert로 표시해 디버깅할 수 있게 했습니다. 근거: `UI/userUI/App.tsx`, `UI/userUI/src/api/backend.ts`, `UI/adminUI/src/api/adminApi.ts`

### TFLite 모델 로딩 안정화

Android plugin은 TensorFlow Lite input tensor shape를 읽어 NCHW/NHWC를 판별하고, input/output buffer를 동적으로 구성했습니다. GPU delegate는 코드상 주석 처리되어 있고 CPU 4 threads로 실행합니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

### 지도 렌더링 보정

관리자 Heatmap은 Leaflet map이 레이아웃 변경 후 잘리는 문제를 줄이기 위해 `invalidateSize`와 resize event를 지연 호출했습니다. 근거: `UI/adminUI/views/Heatmap.tsx`

### 빌드 이력

사용자 앱에는 Vite build 성공 로그가 남아 있습니다. 근거: `UI/userUI/build_log_5.txt`

현재 환경에서 새 빌드는 실행하지 않았습니다. `[확인 필요: 현재 환경 기준 최신 빌드 검증]`

## 10. 배포

배포 URL, hosting 설정, CI/CD 파일은 확인되지 않았습니다. `[확인 필요: 배포 URL 또는 배포 설정 필요]`

사용자 앱은 Capacitor Android 프로젝트를 포함합니다. 근거: `UI/userUI/android/app/build.gradle`, `UI/userUI/capacitor.config.ts`

## 11. 한계와 개선점

- 화면 캡처와 시연 영상은 프로젝트 발표자료에서 가져와야함.
- 관리자 앱은 Supabase 직접 조회와 백엔드 API helper를 함께 가지고 있습니다. 실제 운영 데이터 경로를 하나로 정리해야 합니다. 근거: `UI/adminUI/App.tsx`, `UI/adminUI/src/api/adminApi.ts`
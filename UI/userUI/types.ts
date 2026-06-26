/**
 * types.ts
 * 
 * 애플리케이션 전반에서 여러 컴포넌트와 훅, API 파일이 공용으로 참조하는
 * 공통 타입 선언 및 열거형(Enum) 정의를 중앙 관리하는 파일입니다.
 */

/* ===========================================================================
 * 1. 화면 상태 및 네비게이션 (UI & Navigation States)
 * =========================================================================== */

/**
 * 앱의 전체 화면 분기 상태를 고정하는 열거형
 */
export enum AppScreen {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  RETRY = 'RETRY',
  CONFIRMATION = 'CONFIRMATION',
  GUIDING = 'GUIDING'
}

/**
 * 화면 전환 제어 및 목적지 상태 관리를 위한 설계도
 */
export interface NavigationState {
  currentScreen: AppScreen;
  destination: string | null;
}

/* ===========================================================================
 * 2. API 데이터 모델 (API Request / Response Schemas)
 * =========================================================================== */

/**
 * 백엔드 FastAPI 경로 추천 시스템으로 보행 최적 경로를 요청하기 위한 규격
 */
export interface NavigationRequest {
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
}

/**
 * 길 찾기 결괏값 중 TTS 발화 안내와 위치 체크포인트 판정을 위한 안내 단계 명세
 */
export interface NavigationStep {
  instruction: string;
  latitude: number;
  longitude: number;
}

/**
 * 컴포넌트 렌더링에 적합하게 전처리되어 최종 반환되는 보행 경로 결과물 명세
 */
export interface NavigationResult {
  steps: NavigationStep[];
  path: { latitude: number; longitude: number }[];
}

/**
 * 카메라 객체 탐지를 통해 포착한 위험 요소를 서버로 신고하기 위한 페이로드 규격
 */
export interface ReportPayload {
  latitude: number;
  longitude: number;
  hazard_type: string;
  risk_level: number;
  description?: string;
  imageBase64: string;
  label?: string;
}

/* ===========================================================================
 * 3. 공통 도메인 모델 (Common Domain Entities)
 * =========================================================================== */

/**
 * 기기 GPS 및 지도 표현 시 활용하는 위경도 좌표 규격
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 길안내 시작을 위한 목적지 메타데이터 구조
 */
export interface Destination {
  name: string;
  lat: number;
  lng: number;
}

/**
 * YOLO11n 모델 추론 결과를 정형화하여 도출한 객체 바운딩 박스 결과 구조체
 */
export interface DetectedBox {
  classId: number;
  className: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 음성 재생이 겹쳐서 누락되는 문제를 방지하기 위해 사용되는 TTS 발화 순차 큐 메시지 명세
 */
export interface TtsMessage {
  text: string;
  isObstacle: boolean;
}

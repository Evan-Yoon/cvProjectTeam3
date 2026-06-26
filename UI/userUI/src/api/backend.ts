import { CapacitorHttp } from '@capacitor/core';

// backend.ts는 WalkMate 자체 FastAPI 백엔드에 "보행 경로"를 요청하는 파일입니다.
// TMAP 장소 검색은 tmap.ts가 맡고, 실제 안내용 steps/path 생성은 백엔드가 맡는 구조입니다.

// ---------------------------------------------------------------------------
// 1. 환경 변수 설정
// .env의 VITE_BACKEND_URL을 사용하고, 끝에 슬래시('/')를 붙여 307 에러를 예방합니다.
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

// FastAPI 라우트가 trailing slash를 기대하면 /가 없을 때 307 Redirect가 날 수 있어 명시적으로 붙입니다.
const BACKEND_URL = `${BASE_URL}/api/v1/navigation/path/`;

// [인터페이스] 백엔드에 보낼 데이터 형식
export interface NavigationRequest {
  // 백엔드 계약에 맞춰 lat/lon 이름을 씁니다. 앱 내부의 lng와 같은 의미가 lon입니다.
  start_lat: number;
  start_lon: number; // ★ 백엔드 명세에 맞춘 경도(longitude) 변수명
  end_lat: number;
  end_lon: number;
}

// [인터페이스] 백엔드에서 받을 안내 단계 형식
export interface NavigationStep {
  // instruction은 GuidingScreen에서 TTS로 읽는 문장입니다.
  instruction: string; // "횡단보도 건너기" 등 음성 안내 텍스트
  // latitude/longitude는 사용자가 해당 안내 지점에 도달했는지 거리 계산할 때 씁니다.
  latitude: number;
  longitude: number;
}

// [인터페이스] 최종 반환될 경로 결과물 형식
interface NavigationResult {
  // steps: 음성 안내와 체크포인트 판정용 데이터입니다.
  steps: NavigationStep[];
  // path: 지도에 선으로 그릴 전체 경로 좌표입니다.
  path: { latitude: number; longitude: number }[];
}

// [메인 함수] 서버로 길찾기 경로를 요청합니다.
// @param req 출발지 및 목적지 좌표 데이터
export const requestNavigation = async (req: NavigationRequest): Promise<NavigationResult> => {
  // CapacitorHttp.post에 넘길 요청 옵션입니다.
  // 브라우저 fetch와 달리 모바일 네이티브 HTTP 계층을 통해 요청할 수 있습니다.
  const options = {
    url: BACKEND_URL,
    headers: {
      'Content-Type': 'application/json',
      // Ngrok 경고 페이지를 우회하기 위한 필수 헤더입니다.
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'WalkMate-App',
    },
    data: req, // 데이터 전송 { start_lat, start_lon, ... }
  };

  try {
    console.log(`🚀 백엔드 길찾기 요청 시도 (URL: ${BACKEND_URL})`);
    console.log("📤 요청 데이터 확인:", JSON.stringify(req));

    // Capacitor 전용 HTTP 라이브러리를 사용해 요청을 보냅니다.
    const response = await CapacitorHttp.post(options);

    console.log("📩 백엔드 응답 상태:", response.status);

    // 응답 코드가 200(성공)이고 데이터 상태가 'success'인지 확인합니다.
    // 이 조건이 프론트와 백엔드 응답 계약의 핵심입니다.
    if (response.status === 200 && response.data.status === 'success') {
      const steps = response.data.data; // 음성 안내용 리스트
      let path = response.data.path;    // 지도 시각화용 경로 데이터

      /**
       * [공부 포인트] 데이터 보정 로직
       * 만약 백엔드에서 지도용 'path'를 따로 주지 않는다면, 
       * 안내 단계인 'steps'의 좌표들을 연결해서 경로 선을 임시로 만듭니다.
       */
      if (!path || path.length === 0) {
        // path가 없으면 최소한 steps 좌표를 연결해 지도 선을 그릴 수 있게 fallback을 만듭니다.
        path = steps.map((step: any) => ({
          latitude: step.latitude,
          longitude: step.longitude
        }));
      }

      console.log("✅ 길찾기 경로 확보 완료:", steps.length, "개의 안내 지점");

      // UI에서 사용하기 편한 구조로 정리해서 반환합니다.
      // App.tsx는 이 값을 받아 routeData와 routePath state에 각각 저장합니다.
      return { steps, path };

    } else {
      // 서버에서 에러 메시지를 보낸 경우 처리합니다.
      console.error("❌ 서버 응답 에러 발생:", response.data);
      throw new Error(response.data.message || "길찾기 실패: 서버에서 경로를 찾을 수 없습니다.");
    }
  } catch (error) {
    // 네트워크 연결 자체에 실패한 경우 처리합니다.
    console.error("❌ 네트워크 통신 실패:", error);
    throw error;
  }
};

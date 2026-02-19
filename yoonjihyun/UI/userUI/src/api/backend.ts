// src/api/backend.ts
import { CapacitorHttp } from '@capacitor/core';

// ★ 백엔드 서버 주소 (Vite 환경변수 사용)
// .env 파일에 VITE_BACKEND_URL=http://... 형태로 정의해야 함
const BACKEND_URL = "http://172.30.1.80:8000/api/v1/navigation/path";
// const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000") + "/api/v1/navigation/path";

export interface NavigationRequest {
  start_lat: number;
  start_lon: number; // ★ 백엔드는 lng가 아니라 lon을 원함!
  end_lat: number;
  end_lon: number;
}

export interface NavigationStep {
  instruction: string; // "횡단보도 건너기"
  latitude: number;
  longitude: number;
}

export interface NavigationResponse {
  status: string;
  data: NavigationStep[];
  path?: { latitude: number; longitude: number }[]; // ★ [추가] 전체 경로 좌표
}

// 백엔드에 길찾기 요청 보내기
// ---------------------------------------------------------------------------
// ★ [변경] 반환 타입을 { steps: ..., path: ... } 형태로 변경
// ---------------------------------------------------------------------------
export const requestNavigation = async (req: NavigationRequest): Promise<{ steps: NavigationStep[], path: { latitude: number; longitude: number }[] }> => {
  const options = {
    url: BACKEND_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    data: req, // { start_lat, start_lon, end_lat, end_lon }
  };

  try {
    console.log("🚀 백엔드 길찾기 요청:", JSON.stringify(req));
    const response = await CapacitorHttp.post(options);

    console.log("📩 백엔드 응답 상태:", response.status);
    // console.log("📩 백엔드 응답 데이터:", JSON.stringify(response.data)); 

    if (response.status === 200 && response.data.status === 'success') {
      console.log("✅ 백엔드 길찾기 성공:", response.data.data.length, "개의 단계");
      return {
        steps: response.data.data,
        path: response.data.path || [] // 경로 좌표 (없으면 빈 배열)
      };
    } else {
      console.error("❌ 백엔드 응답 에러:", response.data);
      throw new Error("길찾기 실패: 백엔드 에러");
    }
  } catch (error) {
    console.error("❌ 백엔드 통신 실패:", error);
    throw error;
  }
};
import { CapacitorHttp } from '@capacitor/core';

// ★ 백엔드 서버 주소 (팀원분 IP)
const BACKEND_URL = "http://172.30.1.80:8000/api/v1/navigation/path";

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

// App.tsx에서 사용할 리턴 타입
interface NavigationResult {
  steps: NavigationStep[];
  path: { latitude: number; longitude: number }[];
}

export const requestNavigation = async (req: NavigationRequest): Promise<NavigationResult> => {
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

    if (response.status === 200 && response.data.status === 'success') {
      const steps = response.data.data; // 안내 멘트용 데이터
      let path = response.data.path;    // 지도 그리기용 데이터

      // ★ [핵심] 백엔드가 path를 따로 안 주면, steps의 좌표를 연결해서 경로 선을 만듦
      if (!path || path.length === 0) {
        path = steps.map((step: any) => ({
          latitude: step.latitude,
          longitude: step.longitude
        }));
      }

      console.log("✅ 백엔드 길찾기 성공:", steps.length, "개의 단계");

      // App.tsx가 { steps, path } 구조를 원하므로 맞춰서 반환
      return { steps, path };

    } else {
      console.error("❌ 백엔드 응답 에러:", response.data);
      throw new Error(response.data.message || "길찾기 실패: 백엔드 에러");
    }
  } catch (error) {
    console.error("❌ 백엔드 통신 실패:", error);
    throw error;
  }
};
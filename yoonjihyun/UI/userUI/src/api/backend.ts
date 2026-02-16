// src/api/backend.ts
import { CapacitorHttp } from '@capacitor/core';

// ★ 백엔드 서버 주소 (명세서에 적힌 IP)
const BACKEND_URL = `${process.env.BACKEND_URL}/api/v1/navigation/path`;
process.env.BACKEND_URL

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
}

// 백엔드에 길찾기 요청 보내기
export const requestNavigation = async (req: NavigationRequest): Promise<NavigationStep[]> => {
  const options = {
    url: BACKEND_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    data: req, // { start_lat, start_lon, end_lat, end_lon }
  };

  try {
    const response = await CapacitorHttp.post(options);

    if (response.status === 200 && response.data.status === 'success') {
      console.log("✅ 백엔드 길찾기 성공:", response.data.data.length, "개의 단계");
      return response.data.data; // 경로 데이터 배열 반환
    } else {
      console.error("❌ 백엔드 응답 에러:", response.data);
      throw new Error("길찾기 실패: 백엔드 에러");
    }
  } catch (error) {
    console.error("❌ 백엔드 통신 실패:", error);
    throw error;
  }
};
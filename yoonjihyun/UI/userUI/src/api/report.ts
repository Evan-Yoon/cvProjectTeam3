// src/api/report.ts

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// ★ 서버 주소 수정 (Wi-Fi IPv4 주소 사용)
// ---------------------------------------------------------------------------
const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000") + "/api/v1/reports";

// [헬퍼 함수] Base64 문자열을 이미지 파일(Blob)로 변환
const base64ToBlob = (base64Data: string, contentType: string = 'image/jpeg') => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

// [인터페이스] 신고 데이터 타입 정의
export interface ReportPayload {
  latitude: number;
  longitude: number;
  hazard_type: string; // 예: "kickboard", "Auto_Capture"
  risk_level: number;
  description?: string;
  imageBase64: string; // 카메라에서 받은 원본 데이터 (data:image/... 제외된 것)
}

// [메인 함수] 서버로 신고 전송
export const sendHazardReport = async (payload: ReportPayload) => {
  try {
    const formData = new FormData();

    // 1. 필수 데이터 채우기 (백엔드 명세 준수)
    formData.append('item_id', uuidv4());      // 고유 ID 자동 생성
    formData.append('user_id', uuidv4());      // 사용자 ID (임시 생성)
    formData.append('latitude', payload.latitude.toString());
    formData.append('longitude', payload.longitude.toString());
    formData.append('hazard_type', payload.hazard_type);
    formData.append('risk_level', payload.risk_level.toString());
    formData.append('description', payload.description || '');

    // 2. 이미지 파일 변환 및 추가
    // 백엔드가 'file'이라는 키값으로 이미지를 받으므로 이름을 맞춰야 함
    const imageBlob = base64ToBlob(payload.imageBase64);
    formData.append('file', imageBlob, 'report_image.jpg');

    // 3. 전송 (fetch 사용)
    console.log(`📡 서버로 전송 중... (${API_BASE_URL})`);

    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'POST',
      body: formData,
      // FormData 전송 시 Content-Type 헤더는 자동 설정되므로 생략
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error("❌ Report Upload Failed:", error);
    throw error;
  }
};
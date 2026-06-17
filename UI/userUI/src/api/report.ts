import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// 1. 서버 주소 설정
// .env의 VITE_BACKEND_URL을 우선 사용하고, 끝에 슬래시('/')를 붙여 307 에러를 예방합니다.
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";
// 백엔드 요청대로 reports 뒤에 /를 명확히 붙여줍니다.
const API_BASE_URL = `${BASE_URL}/api/v1/reports/`;

/**
 * [헬퍼 함수] Base64 문자열을 이미지 파일(Blob)로 변환
 * 카메라 앱은 사진 데이터를 텍스트(Base64)로 주지만, 
 * 서버에 "파일"로 올리기 위해서는 이 변환 과정이 필요합니다.
 */
const base64ToBlob = (base64Data: string, contentType: string = 'image/jpeg') => {
  // atob: Base64로 인코딩된 데이터를 디코딩(해석)합니다.
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  // 각 문자를 유니코드 숫자로 변환하여 배열에 담습니다.
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  // 8비트 부호 없는 정수 배열(Uint8Array)로 만들어 실제 데이터 덩어리(Blob)를 생성합니다.
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

// [인터페이스] 신고 데이터의 "설계도"입니다. 어떤 데이터가 오고 가는지 정의합니다.
export interface ReportPayload {
  latitude: number;     // 위도
  longitude: number;    // 경도
  hazard_type: string;  // 위험 요소 종류
  risk_level: number;   // 위험도 등급
  description?: string; // 추가 설명 (선택 사항)
  imageBase64: string;  // 텍스트 형태의 이미지 데이터
  label?: string;       // 감지된 객체 라벨 (예: "person")
}

/**
 * [메인 함수] 서버로 신고 데이터를 전송합니다.
 */
export const sendHazardReport = async (payload: ReportPayload) => {
  try {
    // FormData: 이미지 파일과 텍스트를 한꺼번에 담아 보내는 특수 바구니입니다.
    const formData = new FormData();

    // 1. 필수 데이터 채우기 (백엔드에서 정해준 이름을 똑같이 써야 합니다)
    formData.append('item_id', uuidv4());      // 매 신고마다 고유한 아이디 자동 생성
    formData.append('user_id', uuidv4());      // 사용자 아이디 (기존 UUID 유지, 백엔드 호환성)

    formData.append('label', payload.label);
    formData.append('latitude', payload.latitude.toString());
    formData.append('longitude', payload.longitude.toString());
    formData.append('hazard_type', payload.hazard_type);
    formData.append('risk_level', payload.risk_level.toString());
    formData.append('description', payload.description || '');

    // 2. 이미지 변환 및 추가
    // 백엔드 파이썬 코드에서 'file'이라는 이름으로 사진을 받기 때문에 키값을 'file'로 맞춥니다.
    const imageBlob = base64ToBlob(payload.imageBase64);
    formData.append('file', imageBlob, 'report_image.jpg');

    // 3. 실제 전송 실행
    console.log(`📡 서버로 데이터 전송 중... (${API_BASE_URL})`);

    // 주소 끝에 /가 포함된 API_BASE_URL을 그대로 사용합니다.
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      body: formData,
      // ngrok을 사용할 경우 브라우저 경고 페이지를 통과하기 위한 헤더입니다.
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'WalkMate-App',
      },
    });

    // 서버 응답 확인 (200~299 사이가 아니면 에러로 처리)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server Error: ${response.status} - ${errorText}`);
    }

    // 성공 시 결과 데이터 반환
    const result = await response.json();
    return result;

  } catch (error) {
    console.error("❌ 신고 업로드 실패:", error);
    throw error;
  }
};
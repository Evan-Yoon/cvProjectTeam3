import { v4 as uuidv4 } from 'uuid';
import { ReportPayload } from '../../types';

// report.ts는 VisionCamera가 감지한 위험 요소를 FastAPI 백엔드의 신고 API로 업로드하는 파일입니다.
// 텍스트 필드와 이미지 파일을 함께 보내야 하므로 JSON이 아니라 FormData를 사용합니다.

// ---------------------------------------------------------------------------
// 1. 서버 주소 설정
// .env의 VITE_BACKEND_URL을 우선 사용하고, 끝에 슬래시('/')를 붙여 307 에러를 예방합니다.
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";
// 백엔드 요청대로 reports 뒤에 /를 명확히 붙여줍니다.
const API_BASE_URL = `${BASE_URL}/api/v1/reports/`;

/**
 * Base64 인코딩된 이미지 텍스트 데이터를 멀티파트 전송을 위한 바이너리 Blob 객체로 변환합니다.
 * 
 * @param base64Data - 변환할 Base64 형식의 이미지 데이터 문자열
 * @param contentType - 생성할 Blob의 MIME 타입 (기본값: 'image/jpeg')
 * @returns 바이너리 데이터 덩어리인 Blob 객체
 */
const base64ToBlob = (base64Data: string, contentType: string = 'image/jpeg') => {
  // atob: Base64로 인코딩된 데이터를 디코딩(해석)합니다.
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  // 각 문자를 유니코드 숫자로 변환하여 배열에 담습니다.
  // 브라우저 Blob은 문자열이 아니라 바이트 배열을 받아야 실제 이미지 파일처럼 전송됩니다.
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  // 8비트 부호 없는 정수 배열(Uint8Array)로 만들어 실제 데이터 덩어리(Blob)를 생성합니다.
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
};

/**
 * 실시간 객체 탐지 중 감지된 위험 요소를 위치 및 증빙 이미지와 함께 서버의 신고 API로 전송합니다.
 * 
 * @param payload - 신고 위경도, 위험 종류, 등급, Base64 이미지 텍스트를 담은 정보 객체
 */
export const sendHazardReport = async (payload: ReportPayload) => {
  try {
    // FormData: 이미지 파일과 텍스트를 한꺼번에 담아 보내는 특수 바구니입니다.
    const formData = new FormData();

    // 1. 필수 데이터 채우기 (백엔드에서 정해준 이름을 똑같이 써야 합니다)
    // 현재는 매 신고마다 임시 UUID를 만들고 있습니다. 실제 로그인/사용자 관리가 붙으면 user_id는 인증 사용자 ID로 바뀔 수 있습니다.
    formData.append('item_id', uuidv4());      // 매 신고마다 고유한 아이디 자동 생성
    formData.append('user_id', uuidv4());      // 사용자 아이디 (기존 UUID 유지, 백엔드 호환성)

    // append의 첫 번째 인자는 백엔드가 기대하는 필드명과 정확히 일치해야 합니다.
    formData.append('label', payload.label);
    formData.append('latitude', payload.latitude.toString());
    formData.append('longitude', payload.longitude.toString());
    formData.append('hazard_type', payload.hazard_type);
    formData.append('risk_level', payload.risk_level.toString());
    formData.append('description', payload.description || '');

    // 2. 이미지 변환 및 추가
    // 백엔드 파이썬 코드에서 'file'이라는 이름으로 사진을 받기 때문에 키값을 'file'로 맞춥니다.
    const imageBlob = base64ToBlob(payload.imageBase64);
    // 세 번째 인자 'report_image.jpg'는 서버가 받는 파일명입니다.
    formData.append('file', imageBlob, 'report_image.jpg');

    // 3. 실제 전송 실행
    console.log(`📡 서버로 데이터 전송 중... (${API_BASE_URL})`);

    // 주소 끝에 /가 포함된 API_BASE_URL을 그대로 사용합니다.
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      body: formData,
      // FormData를 보낼 때 Content-Type은 직접 지정하지 않습니다.
      // 브라우저가 multipart boundary를 포함한 Content-Type을 자동으로 만들어야 하기 때문입니다.
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

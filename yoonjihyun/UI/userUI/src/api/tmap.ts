import { CapacitorHttp, HttpOptions } from '@capacitor/core';

// ★ 실제 발급받은 TMAP API Key (보안에 주의하세요)
const TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj';
const TMAP_BASE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

export interface Location {
    latitude: number;
    longitude: number;
}

/**
 * TMAP 보행자 경로 안내 API 요청 함수
 * @param start 출발지 좌표 { latitude, longitude }
 * @param end 도착지 좌표 { latitude, longitude }
 * @returns TMAP 경로 데이터 (GeoJSON 포맷)
 */
export const requestTmapWalkingPath = async (start: Location, end: Location) => {
    // 1. 입력 좌표 유효성 검사 (안전장치)
    if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
        console.error("❌ 유효하지 않은 좌표입니다.", { start, end });
        throw new Error("Invalid Start or End Location");
    }

    try {
        // 2. 요청 옵션 설정 (HttpOptions 타입 명시)
        const options: HttpOptions = {
            url: TMAP_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
                'appKey': TMAP_APP_KEY, // TMAP은 'appKey' 헤더를 사용합니다.
            },
            // Body 데이터 구성
            data: {
                startX: start.longitude, // TMAP X = 경도 (Longitude)
                startY: start.latitude,  // TMAP Y = 위도 (Latitude)
                endX: end.longitude,
                endY: end.latitude,
                reqCoordType: 'WGS84GEO', // 요청 좌표계: 위경도
                resCoordType: 'WGS84GEO', // 응답 좌표계: 위경도
                startName: 'Start',       // 출발지 명칭 (필수)
                endName: 'End',           // 도착지 명칭 (필수)
                searchOption: '0',        // 0: 추천 경로 (가장 빠르고 안전한 길)
                sort: 'index',            // 안내 순서대로 정렬
            },
        };

        // 3. CapacitorHttp를 통해 POST 요청 (Native 레벨 통신으로 CORS 우회)
        const response = await CapacitorHttp.post(options);

        // 4. 응답 상태 체크
        if (response.status !== 200) {
            console.error('❌ TMAP API Error Response:', response.data);
            // 에러 메시지가 구체적으로 있다면 포함하여 throw
            const errorMsg = response.data?.error?.message || JSON.stringify(response.data);
            throw new Error(`TMAP API Failed (${response.status}): ${errorMsg}`);
        }

        // 5. 성공 시 데이터 반환
        // console.log('✅ TMAP Path Found:', response.data.features?.length, 'features');
        return response.data;

    } catch (error) {
        console.error('❌ requestTmapWalkingPath Exception:', error);
        throw error;
    }
};
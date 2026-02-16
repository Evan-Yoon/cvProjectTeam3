import { CapacitorHttp, HttpOptions } from '@capacitor/core';

// ★ 실제 발급받은 TMAP API Key
const TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj';

// 1. 경로 안내 URL (POST)
const TMAP_ROUTE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

// 2. 장소 검색 URL (GET) - 새로 추가됨
const TMAP_POI_URL = 'https://apis.openapi.sk.com/tmap/pois';

export interface Location {
    latitude: number;
    longitude: number;
}

// ------------------------------------------------------------------
// 1. TMAP 보행자 경로 안내 API 요청 함수 (기존 코드 유지)
// ------------------------------------------------------------------
export const requestTmapWalkingPath = async (start: Location, end: Location) => {
  // 1. 입력 좌표 유효성 검사
    if (!start?.latitude || !start?.longitude || !end?.latitude || !end?.longitude) {
    console.error("❌ 유효하지 않은 좌표입니다.", { start, end });
    throw new Error("Invalid Start or End Location");
    }

    try {
    const options: HttpOptions = {
        url: TMAP_ROUTE_URL,
        headers: {
        'Content-Type': 'application/json',
        'appKey': TMAP_APP_KEY,
        },
        data: {
        startX: start.longitude,
        startY: start.latitude,
        endX: end.longitude,
        endY: end.latitude,
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
        startName: 'Start',
        endName: 'End',
        searchOption: '0',
        sort: 'index',
        },
    };

    const response = await CapacitorHttp.post(options);

    if (response.status !== 200) {
        console.error('❌ TMAP API Error Response:', response.data);
        const errorMsg = response.data?.error?.message || JSON.stringify(response.data);
        throw new Error(`TMAP API Failed (${response.status}): ${errorMsg}`);
    }

    return response.data;

    } catch (error) {
    console.error('❌ requestTmapWalkingPath Exception:', error);
    throw error;
    }
};

// ------------------------------------------------------------------
// 2. ★ [추가됨] 장소 검색(POI) API 함수
// "광교중앙역" 같은 텍스트를 입력받아 좌표(위도, 경도)를 반환합니다.
// ------------------------------------------------------------------
export const searchLocation = async (keyword: string) => {
    if (!keyword) return null;

    try {
    // 한글 깨짐 방지를 위한 인코딩
    const encodedKeyword = encodeURIComponent(keyword);

    // GET 요청 URL 구성
    const requestUrl = `${TMAP_POI_URL}?version=1&searchKeyword=${encodedKeyword}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1`;

    const options: HttpOptions = {
        url: requestUrl,
        headers: {
        'Accept': 'application/json',
        'appKey': TMAP_APP_KEY // 기존 키 재사용
        },
      method: 'GET' // 검색은 GET 방식입니다
    };

    // 요청 전송
    const response = await CapacitorHttp.get(options);

    // 응답 확인
    if (response.status === 200 && response.data.searchPoiInfo && response.data.searchPoiInfo.totalCount > 0) {
      // 가장 정확도가 높은 첫 번째 결과 가져오기
        const poi = response.data.searchPoiInfo.pois.poi[0];

        console.log(`✅ 장소 검색 성공: ${poi.name} (${poi.noorLat}, ${poi.noorLon})`);

        return {
        name: poi.name,          // 장소 이름 (예: 광교중앙역 신분당선)
        lat: Number(poi.noorLat), // 위도 (문자열로 오므로 숫자로 변환)
        lng: Number(poi.noorLon)  // 경도
        };
    } else {
        console.warn(`⚠️ 검색 결과가 없습니다: ${keyword}`);
        return null;
    }
    } catch (error) {
    console.error("❌ TMap POI 검색 실패:", error);
    return null;
    }
};
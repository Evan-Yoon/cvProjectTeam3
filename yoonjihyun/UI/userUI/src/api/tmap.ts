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
// ------------------------------------------------------------------
// 2. ★ [수정됨] 장소 검색(POI) API 함수 (내 위치 기준 검색 추가)
// ------------------------------------------------------------------
export const searchLocation = async (keyword: string, lat?: number, lng?: number) => {
    if (!keyword) return null;

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        let requestUrl = `${TMAP_POI_URL}?version=1&searchKeyword=${encodedKeyword}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1`;

        // 내 위치가 있으면 반경 검색 파라미터 추가 (또는 정렬 옵션)
        // TMAP POI 검색에서 centerLat/centerLon을 넣으면 해당 위치 중심으로 검색됨
        if (lat && lng) {
            requestUrl += `&centerLat=${lat}&centerLon=${lng}&searchType=name&searchtypCd=A`;
            // searchType=name (명칭검색), searchtypCd=A (거리순 정렬 등 옵션 확인 필요, 보통 center 좌표 주면 거기가 우선됨)
        }

        const options: HttpOptions = {
            url: requestUrl,
            headers: {
                'Accept': 'application/json',
                'appKey': TMAP_APP_KEY
            },
            method: 'GET'
        };

        const response = await CapacitorHttp.get(options);

        if (response.status === 200 && response.data.searchPoiInfo && response.data.searchPoiInfo.totalCount > 0) {
            const poi = response.data.searchPoiInfo.pois.poi[0];
            console.log(`✅ 장소 검색 성공: ${poi.name} (${poi.noorLat}, ${poi.noorLon})`);
            return {
                name: poi.name,
                lat: Number(poi.noorLat),
                lng: Number(poi.noorLon)
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

// ------------------------------------------------------------------
// 3. ★ [추가됨] 역지오코딩 (좌표 -> 주소 변환)
// ------------------------------------------------------------------
export const reverseGeoCoding = async (lat: number, lng: number) => {
    try {
        const requestUrl = `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?version=1&lat=${lat}&lon=${lng}&coordType=WGS84GEO&addressType=A04`;

        const options: HttpOptions = {
            url: requestUrl,
            headers: { 'appKey': TMAP_APP_KEY },
            method: 'GET'
        };

        const response = await CapacitorHttp.get(options);

        if (response.status === 200 && response.data.addressInfo) {
            const info = response.data.addressInfo;
            // 전체 주소 조합
            return info.fullAddress || `${info.city_do} ${info.gu_gun} ${info.dong}`;
        }
        return null;
    } catch (error) {
        console.error("❌ Reverse Geocoding Failed:", error);
        return null;
    }
};

// ------------------------------------------------------------------
// 4. ★ [추가됨] 주변 장소 검색 (반경 검색)
// ------------------------------------------------------------------
export const searchNearbyPoi = async (lat: number, lng: number) => {
    try {
        const requestUrl = `https://apis.openapi.sk.com/tmap/pois/search/around?version=1&centerLat=${lat}&centerLon=${lng}&radius=1&count=3`;
        // radius=1 (1km), count=3 (3개만)

        const options: HttpOptions = {
            url: requestUrl,
            headers: { 'appKey': TMAP_APP_KEY },
            method: 'GET'
        };

        const response = await CapacitorHttp.get(options);

        if (response.status === 200 && response.data.searchPoiInfo && response.data.searchPoiInfo.pois) {
            return response.data.searchPoiInfo.pois.poi.map((p: any) => p.name);
        }
        return [];
    } catch (error) {
        console.error("❌ Nearby Search Failed:", error);
        return [];
    }
};

import { CapacitorHttp, HttpOptions } from '@capacitor/core';

// ★ 실제 발급받은 TMAP API Key
const TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj';

// URL 정의
const TMAP_ROUTE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';
const TMAP_POI_URL = 'https://apis.openapi.sk.com/tmap/pois';

// ------------------------------------------------------------------
// 1. 장소 검색(POI) API 함수 (이름 -> 좌표)
// App.tsx에서 searchLocation(keyword, lat, lng) 형태로 호출함
// ------------------------------------------------------------------
export const searchLocation = async (keyword: string, lat?: number, lng?: number) => {
    if (!keyword) return null;

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        let requestUrl = `${TMAP_POI_URL}?version=1&searchKeyword=${encodedKeyword}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=1`;

        // 내 위치(lat, lng)가 있으면 반경 검색을 위해 파라미터 추가
        if (lat && lng) {
            requestUrl += `&centerLat=${lat}&centerLon=${lng}`;
        }

        console.log("🔍 TMAP Search Request:", keyword);

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
            console.log(`✅ 장소 검색 성공: ${poi.name}`);
            return {
                name: poi.name,
                lat: Number(poi.noorLat),
                lng: Number(poi.noorLon)
            };
        } else {
            console.warn(`⚠️ 검색 결과 없음: ${keyword}`);
            return null;
        }
    } catch (error) {
        console.error("❌ TMap POI 검색 실패:", error);
        return null;
    }
};

// ------------------------------------------------------------------
// 2. TMAP 보행자 경로 안내 API 요청 (기존 유지)
// ------------------------------------------------------------------
export const requestTmapWalkingPath = async (start: { latitude: number, longitude: number }, end: { latitude: number, longitude: number }) => {
    if (!start?.latitude || !end?.latitude) throw new Error("Invalid Location");

    try {
        const options: HttpOptions = {
            url: TMAP_ROUTE_URL,
            headers: { 'Content-Type': 'application/json', 'appKey': TMAP_APP_KEY },
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
        return response.data;
    } catch (error) {
        console.error('❌ requestTmapWalkingPath Error:', error);
        throw error;
    }
};

// ------------------------------------------------------------------
// 3. 역지오코딩 (좌표 -> 주소 변환)
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
            return info.fullAddress || `${info.city_do} ${info.gu_gun} ${info.dong}`;
        }
        return null;
    } catch (error) {
        console.error("❌ Reverse Geocoding Failed:", error);
        return null;
    }
};
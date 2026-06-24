import { CapacitorHttp, HttpOptions } from '@capacitor/core';

// tmap.ts는 SK TMAP 외부 API 호출을 모아둔 파일입니다.
// App.tsx에서는 주로 searchLocation()으로 "말한 장소 이름 -> 좌표" 변환을 합니다.

// ★ 실제 발급받은 TMAP API Key (환경변수로 처리, fallback 지원)
const TMAP_APP_KEY = import.meta.env.VITE_TMAP_API_KEY;

// URL 정의
// 보행자 경로 URL은 현재 백엔드 경로 요청으로 대체되었지만, 직접 TMAP 호출용 함수는 남아 있습니다.
const TMAP_ROUTE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';
const TMAP_POI_URL = 'https://apis.openapi.sk.com/tmap/pois';

// ------------------------------------------------------------------
// 1. 장소 검색(POI) API 함수 (이름 -> 좌표)
// App.tsx에서 searchLocation(keyword, lat, lng) 형태로 호출함
// ------------------------------------------------------------------
export const searchLocation = async (keyword: string, lat?: number, lng?: number) => {
    // 빈 문자열로 API를 호출하면 불필요한 요청이므로 바로 실패 처리합니다.
    if (!keyword) return null;

    try {
        // URL 쿼리에 한글/공백이 들어가면 깨질 수 있으므로 percent-encoding합니다.
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
                // appKey는 TMAP이 요청자를 인증하는 API 키입니다.
                'appKey': TMAP_APP_KEY
            },
            method: 'GET'
        };

        const response = await CapacitorHttp.get(options);

        if (response.status === 200 && response.data.searchPoiInfo && response.data.searchPoiInfo.totalCount > 0) {
            const poi = response.data.searchPoiInfo.pois.poi[0];
            console.log(`✅ 장소 검색 성공: ${poi.name}`);
            // TMAP 응답의 noorLat/noorLon은 문자열일 수 있어 Number로 변환합니다.
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
    // 최소한 위도 값이 있어야 요청할 수 있습니다. 경도까지 더 엄격히 확인하면 더 안전합니다.
    if (!start?.latitude || !end?.latitude) throw new Error("Invalid Location");

    try {
        const options: HttpOptions = {
            url: TMAP_ROUTE_URL,
            headers: { 'Content-Type': 'application/json', 'appKey': TMAP_APP_KEY },
            data: {
                // TMAP은 X=경도(longitude), Y=위도(latitude) 이름을 씁니다.
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
        // 역지오코딩은 좌표를 사람이 읽을 수 있는 주소 문자열로 바꾸는 API입니다.
        const requestUrl = `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?version=1&lat=${lat}&lon=${lng}&coordType=WGS84GEO&addressType=A04`;
        const options: HttpOptions = {
            url: requestUrl,
            headers: { 'appKey': TMAP_APP_KEY },
            method: 'GET'
        };
        const response = await CapacitorHttp.get(options);

        if (response.status === 200 && response.data.addressInfo) {
            const info = response.data.addressInfo;
            // fullAddress가 있으면 가장 읽기 쉬운 전체 주소를 쓰고, 없으면 시/구/동 조합으로 fallback합니다.
            return info.fullAddress || `${info.city_do} ${info.gu_gun} ${info.dong}`;
        }
        return null;
    } catch (error) {
        console.error("❌ Reverse Geocoding Failed:", error);
        return null;
    }
};

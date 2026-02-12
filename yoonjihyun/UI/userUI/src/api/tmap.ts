import { CapacitorHttp } from '@capacitor/core';

// ★ 실제 키로 꼭 바꾸세요!
const TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj';
const TMAP_BASE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

export interface Location {
    latitude: number;
    longitude: number;
}

export const requestTmapWalkingPath = async (start: Location, end: Location) => {
    try {
        const options = {
            url: TMAP_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
                'appKey': TMAP_APP_KEY, // 대소문자 주의 (appKey)
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

        // fetch 대신 CapacitorHttp.post 사용
        const response = await CapacitorHttp.post(options);

        // 에러 확인 (status가 200이 아니면 에러)
        if (response.status !== 200) {
            console.error('TMAP Error Response:', response.data);
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(response.data)}`);
        }

        return response.data;

    } catch (error) {
        console.error('TMAP Request Failed:', error);
        throw error;
    }
};
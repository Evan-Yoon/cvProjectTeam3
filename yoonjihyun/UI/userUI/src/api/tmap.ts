// src/api/tmap.ts

// TMAP API 설정
const TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj'; // SK Open API에서 발급받은 키
const TMAP_BASE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json';

export interface Location {
    latitude: number;
    longitude: number;
}

export const requestTmapWalkingPath = async (start: Location, end: Location) => {
    try {
        const response = await fetch(TMAP_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'appKey': TMAP_APP_KEY,
            },
            body: JSON.stringify({
                startX: start.longitude,
                startY: start.latitude,
                endX: end.longitude,
                endY: end.latitude,
                reqCoordType: 'WGS84GEO', // 위도/경도 사용
                resCoordType: 'WGS84GEO',
                startName: '출발지',
                endName: '목적지',
                searchOption: '0',
                sort: 'index',
            }),
        });

        const data = await response.json();
        return data; // 경로 데이터 반환
    } catch (error) {
        console.error('TMAP API Error:', error);
        throw error;
    }
};
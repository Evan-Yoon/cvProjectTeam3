// components/DebugMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet'; // Leaflet 기본 객체
import 'leaflet/dist/leaflet.css';

// -----------------------------------------------------------
// 1. Props 인터페이스 정의
// GuidingScreen에서 넘겨주는 데이터 타입과 일치해야 합니다.
// -----------------------------------------------------------
interface DebugMapProps {
    path?: { latitude: number; longitude: number }[]; // ★ [변경] 단순화된 경로 좌표
    currentPos: { lat: number; lng: number } | null;
    currentHeading?: number | null;
}

const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);
    return null;
};

const DebugMap: React.FC<DebugMapProps> = ({ path, currentPos, currentHeading }) => {

    // 3. 경로 데이터 변환 (Leaflet은 [lat, lng] 배열 필요)
    const pathPositions = path?.map(p => [p.latitude, p.longitude]) || [];

    // 지도 초기 중심값 (내 위치 없으면 서울 시청)
    const center: [number, number] = currentPos
        ? [currentPos.lat, currentPos.lng]
        : [37.5665, 126.9780];

    // 4. 내 위치 마커 아이콘 생성 (빨간색 화살표)
    // 바라보는 방향(heading)에 따라 회전시킵니다.
    const createUserIcon = (heading: number | null) => {
        const rotation = heading ?? 0; // 방향 없으면 0도

        // SVG로 빨간색 화살표(네비게이션 스타일) 생성
        const svgArrow = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); transition: transform 0.3s ease;">
                <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="#ff0000" stroke="white" stroke-width="2"/>
            </svg>
        `;

        return L.divIcon({
            className: 'custom-user-icon', // CSS 클래스 이름 (필요 시 스타일 추가)
            html: svgArrow,
            iconSize: [32, 32], // 아이콘 크기
            iconAnchor: [16, 16], // 아이콘의 중심점 (회전축)
        });
    };

    return (
        // ★ 높이를 h-full로 변경하여 부모(50%)에 꽉 차게 설정
        <div className="w-full h-full bg-gray-100 border-b-4 border-blue-500 relative z-0">

            <MapContainer
                center={center}
                zoom={19} // 줌 레벨 확대 (보행자용이라 크게)
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false} // 모바일에서 실수로 줌 되는 것 방지
                zoomControl={false} // 줌 버튼 숨김 (깔끔하게)
            >
                {/* 지도 타일 (오픈스트리트맵) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* 내 위치 자동 추적 기능 */}
                {currentPos && <ChangeView center={[currentPos.lat, currentPos.lng]} />}

                {/* 경로 그리기 (파란선) */}
                {pathPositions.length > 0 && (
                    <Polyline positions={pathPositions as [number, number][]} color="blue" weight={6} opacity={0.7} />
                )}

                {/* 내 위치 표시 (빨간 화살표 마커) */}
                {currentPos && (
                    <Marker
                        position={[currentPos.lat, currentPos.lng]}
                        icon={createUserIcon(currentHeading ?? 0)}
                    />
                )}
            </MapContainer>

            {/* 디버깅 모드 배지 */}
            <div className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full shadow-lg z-[1000] border border-gray-200">
                <p className="text-xs font-bold text-gray-700">
                    🧭 {currentHeading ? `${currentHeading.toFixed(0)}°` : '방향 찾는 중...'}
                </p>
            </div>
        </div>
    );
};

export default DebugMap;
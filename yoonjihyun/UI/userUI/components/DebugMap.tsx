// components/DebugMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// -----------------------------------------------------------
// 1. Props 인터페이스 정의
// -----------------------------------------------------------
interface DebugMapProps {
    path?: { latitude: number; longitude: number }[];
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

    // 경로 데이터 변환
    const pathPositions = path?.map(p => [p.latitude, p.longitude] as [number, number]) || [];

    // 도착지 좌표 (경로의 맨 마지막 지점)
    const destinationPos = pathPositions.length > 0 ? pathPositions[pathPositions.length - 1] : null;

    // 지도 초기 중심값
    const center: [number, number] = currentPos
        ? [currentPos.lat, currentPos.lng]
        : [37.5665, 126.9780];

    // -----------------------------------------------------------
    // 2. 커스텀 아이콘 생성 함수들
    // -----------------------------------------------------------

    // (1) 내 위치 마커 (빨간색 회전 화살표)
    const createUserIcon = (heading: number | null) => {
        const rotation = heading ?? 0;
        const svgArrow = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); transition: transform 0.3s ease;">
                <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="#ff0000" stroke="white" stroke-width="2"/>
            </svg>
        `;
        return L.divIcon({
            className: 'custom-user-icon',
            html: svgArrow,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    };

    // (2) ★ [추가] 도착지 깃발 마커 (빨간 깃발)
    const createFlagIcon = () => {
        const svgFlag = `
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.4));">
                <path d="M8 2 L8 30" stroke="#333" stroke-width="3" stroke-linecap="round"/>
                <path d="M8 4 L26 11 L8 18 Z" fill="#ff0000" stroke="white" stroke-width="1"/>
            </svg>
        `;
        return L.divIcon({
            className: 'custom-flag-icon',
            html: svgFlag,
            iconSize: [32, 32],
            iconAnchor: [8, 30], // 깃대의 맨 아래쪽(x:8, y:30)을 좌표에 딱 맞춤
        });
    };

    return (
        <div className="w-full h-full bg-gray-100 border-b-4 border-blue-500 relative z-0">
            <MapContainer
                center={center}
                zoom={19}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                zoomControl={false}
            >
                {/* 1. 배경 지도 (오픈스트리트맵) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {currentPos && <ChangeView center={[currentPos.lat, currentPos.lng]} />}

                {/* 2. 경로 그리기 (파란선) */}
                {pathPositions.length > 0 && (
                    <Polyline
                        positions={pathPositions}
                        pathOptions={{ color: 'blue', weight: 6, opacity: 0.6 }}
                    />
                )}

                {/* 3. 꺾이는 분기점 표시 (노란색 점) - 마지막 지점(도착지)은 제외! */}
                {pathPositions.map((pos, index) => {
                    // 마지막 도착지는 깃발을 꽂아야 하므로 노란 점은 그리지 않습니다.
                    if (index === pathPositions.length - 1) return null;

                    return (
                        <CircleMarker
                            key={index}
                            center={pos}
                            pathOptions={{
                                color: 'orange',
                                fillColor: 'yellow',
                                fillOpacity: 1,
                                weight: 2
                            }}
                            radius={5}
                        />
                    );
                })}

                {/* 4. ★ [추가] 도착지 깃발 표시 */}
                {destinationPos && (
                    <Marker
                        position={destinationPos}
                        icon={createFlagIcon()}
                    />
                )}

                {/* 5. 내 위치 표시 (빨간 화살표) */}
                {currentPos && (
                    <Marker
                        position={[currentPos.lat, currentPos.lng]}
                        icon={createUserIcon(currentHeading ?? 0)}
                        zIndexOffset={100} // 화살표가 선이나 점에 안 가려지고 항상 맨 위에 오도록
                    />
                )}
            </MapContainer>

            {/* 방향 디버깅 배지 */}
            <div className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full shadow-lg z-[1000] border border-gray-200">
                <p className="text-xs font-bold text-gray-700">
                    🧭 {currentHeading ? `${currentHeading.toFixed(0)}°` : '방향 찾는 중...'}
                </p>
            </div>
        </div>
    );
};

export default DebugMap;
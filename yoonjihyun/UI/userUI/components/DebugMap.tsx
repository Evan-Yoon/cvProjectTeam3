// components/DebugMap.tsx
import React from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // 스타일 필수

interface DebugMapProps {
    routeFeatures: any[]; // TMAP 경로 데이터
    currentPos: { lat: number; lng: number } | null; // 내 현재 위치
}

const DebugMap: React.FC<DebugMapProps> = ({ routeFeatures, currentPos }) => {
    // 1. TMAP 데이터를 Leaflet 경로(Polyline) 형식으로 변환 [[lat, lng], [lat, lng]...]
    const pathPositions = routeFeatures
        .filter(f => f.geometry.type === 'LineString') // 선 데이터만 추출
        .flatMap(f => {
            // TMAP은 [lng, lat] 순서라 [lat, lng]로 뒤집어야 함
            return f.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
        });

    // 지도의 중심점 (내 위치가 없으면 기본값 서울)
    const center = currentPos ? [currentPos.lat, currentPos.lng] : [37.5665, 126.9780];

    return (
        <div className="w-full h-1/2 bg-gray-100 border-b-4 border-blue-500 relative z-50">
            {/* 맵 컨테이너 (높이 지정 필수) */}
            <MapContainer
                center={center as [number, number]}
                zoom={18}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false} // 모바일 스크롤 방해 금지
            >
                {/* 무료 오픈스트리트맵 타일 사용 */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* 경로 그리기 (파란선) */}
                {pathPositions.length > 0 && (
                    <Polyline positions={pathPositions as [number, number][]} color="blue" weight={5} />
                )}

                {/* 내 위치 표시 (빨간 점) */}
                {currentPos && (
                    <CircleMarker
                        center={[currentPos.lat, currentPos.lng]}
                        radius={8}
                        pathOptions={{ color: 'red', fillColor: '#f03', fillOpacity: 1 }}
                    />
                )}
            </MapContainer>

            <div className="absolute top-2 right-2 bg-white p-2 rounded shadow z-[1000] text-black text-xs font-bold">
                디버깅 모드
            </div>
        </div>
    );
};

export default DebugMap;
// components/DebugMap.tsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// DebugMap은 안내 화면 상단에 현재 위치, 경로 선, 체크포인트, 도착지를 시각화하는 개발/검증용 지도입니다.
// react-leaflet은 Leaflet 지도 엔진을 React 컴포넌트처럼 쓸 수 있게 감싼 라이브러리입니다.

// -----------------------------------------------------------
// 1. Props 인터페이스 정의
// -----------------------------------------------------------
interface DebugMapProps {
    // 백엔드가 내려준 전체 경로 좌표입니다. Polyline으로 파란 선을 그립니다.
    path?: { latitude: number; longitude: number }[];
    // 현재 GPS 위치입니다. null이면 서울시청 좌표를 기본 중심으로 사용합니다.
    currentPos: { lat: number; lng: number } | null;
    // 나침반/GPS 보정으로 계산된 사용자 방향입니다. 내 위치 화살표를 회전시킬 때 씁니다.
    currentHeading?: number | null;
}

// React props가 바뀌었을 때 Leaflet 지도 인스턴스의 중심을 이동시키는 작은 헬퍼 컴포넌트입니다.
const ChangeView = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        // setView는 imperative API라서 JSX 속성 변경만으로는 호출되지 않습니다.
        // 그래서 useMap으로 지도 객체를 얻어 직접 중심을 갱신합니다.
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);
    return null;
};

const DebugMap: React.FC<DebugMapProps> = ({ path, currentPos, currentHeading }) => {

    // 경로 데이터 변환
    // Leaflet은 [lat, lng] 튜플 배열을 기대하므로 백엔드 객체 배열을 변환합니다.
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
        // divIcon은 이미지 파일 대신 HTML/SVG 문자열로 마커를 만들 수 있게 해줍니다.
        // 여기서는 SVG 화살표 자체를 회전시켜 사용자의 진행 방향을 보여줍니다.
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
        // 도착지는 일반 체크포인트와 구분되도록 깃발 아이콘을 별도로 만듭니다.
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
                // 안내 화면에서는 사용자가 지도를 조작하기보다 현재 위치를 보는 용도라 휠 줌/기본 줌 버튼을 끕니다.
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
                {/* pathPositions가 비어 있으면 Polyline을 렌더링하지 않습니다. */}
                {pathPositions.length > 0 && (
                    <Polyline
                        positions={pathPositions}
                        pathOptions={{ color: 'blue', weight: 6, opacity: 0.6 }}
                    />
                )}

                {/* 3. 꺾이는 분기점 표시 (노란색 점) - 마지막 지점(도착지)은 제외! */}
                {/* 각 중간 지점은 CircleMarker로 표시해 실제 안내 체크포인트를 눈으로 확인할 수 있게 합니다. */}
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

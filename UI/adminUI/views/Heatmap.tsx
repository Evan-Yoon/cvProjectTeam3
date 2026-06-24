import React, { useState, useEffect } from 'react';
import { HazardData } from '../types';
import { Filter, AlertTriangle, Navigation as NavIcon } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HeatmapProps {
    // App.tsx에서 정규화한 신고 데이터입니다. location 문자열에서 좌표를 파싱해 지도에 표시합니다.
    data: HazardData[];
    isDarkMode: boolean;
    // 상세 모달에서 "위치 지도 보기"를 누르면 이 좌표가 들어옵니다.
    initialCenter?: [number, number] | null;
}

// ★ 회색 잘림을 원천 차단하는 강력한 업데이트 헬퍼
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();

    useEffect(() => {
        // centerPosition이 바뀌면 지도 중심을 부드럽게 이동합니다.
        map.flyTo(center, 14, { duration: 1.5 });
    }, [center, map]);

    useEffect(() => {
        // 0.1초, 0.5초, 1초 뒤에 지도를 강제로 재계산합니다. (로딩 지연 대비 완벽 방어)
        // Leaflet은 컨테이너 크기가 늦게 확정되면 회색 타일이 보일 수 있어 invalidateSize가 필요합니다.
        const timers = [100, 500, 1000].map(t => setTimeout(() => {
            map.invalidateSize();
            window.dispatchEvent(new Event('resize'));
        }, t));

        return () => timers.forEach(clearTimeout);
    }, [map]);

    return null;
};

// Leaflet Marker에 이미지 파일 대신 HTML/SVG를 넣기 위한 커스텀 아이콘입니다.
const redArrowHtml = `
  <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); transform: rotate(45deg);">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
    </svg>
  </div>
`;

const redArrowIcon = new L.DivIcon({
    html: redArrowHtml,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});

const Heatmap: React.FC<HeatmapProps> = ({ data, isDarkMode, initialCenter }) => {
    // activeRisk는 지도 왼쪽 필터에서 선택한 위험도입니다.
    const [activeRisk, setActiveRisk] = useState<string>('All');
    // 지도 중심 좌표입니다. 초기값은 서울시청 근처 좌표입니다.
    const [centerPosition, setCenterPosition] = useState<[number, number]>(initialCenter || [37.5665, 126.9780]);
    const [myLocation, setMyLocation] = useState<[number, number] | null>(null);

    const moveToMyLocation = () => {
        // 브라우저 Geolocation API로 관리자 PC/브라우저의 현재 위치를 가져옵니다.
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
                    setCenterPosition(loc);
                    setMyLocation(loc);
                },
                (error) => {
                    console.warn("위치 정보를 가져올 수 없습니다.", error);
                },
                { enableHighAccuracy: true }
            );
        }
    };

    useEffect(() => {
        // 외부에서 포커스 좌표가 들어오면 그 좌표로 이동하고, 없으면 내 위치를 시도합니다.
        if (initialCenter) {
            setCenterPosition(initialCenter);
        } else {
            moveToMyLocation();
        }
    }, [initialCenter]);

    const mapData = data.map(d => {
        try {
            // App.tsx에서 만든 "위도: xx, 경도: yy" 문자열을 Leaflet 좌표 숫자로 되돌립니다.
            const latStr = d.location.split('위도: ')[1]?.split(',')[0];
            const lngStr = d.location.split('경도: ')[1];
            return { ...d, lat: parseFloat(latStr), lng: parseFloat(lngStr) };
        } catch {
            return { ...d, lat: NaN, lng: NaN };
        }
    }).filter(d => !isNaN(d.lat) && !isNaN(d.lng));

    // All이면 전체 표시, 아니면 선택한 위험도만 표시합니다.
    const filteredData = activeRisk === 'All' ? mapData : mapData.filter(d => d.riskLevel === activeRisk);

    const getBlobColor = (level: string) => {
        // CircleMarker 색상은 위험도와 같은 색상 체계를 사용합니다.
        if (level === 'High') return '#ef4444';
        if (level === 'Medium') return '#f59e0b';
        return '#3b82f6';
    };

    // 다크모드에 따라 Carto 지도 타일 스타일을 바꿉니다.
    const tileUrl = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500 gap-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>위험 지역 히트맵</h2>
                    <p className={`mt-1 transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        접수된 장애물 데이터를 기반으로 실제 지도 위에 위험 밀집 구역을 시각화합니다.
                    </p>
                </div>
            </div>

            <div className="flex flex-1 gap-6 min-h-0 relative">
                <div className={`w-72 rounded-xl border flex flex-col p-5 transition-colors duration-300 z-10 relative ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-6">
                        <Filter size={20} className={isDarkMode ? 'text-yellow-400' : 'text-slate-600'} />
                        <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>지도 필터</h3>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className={`block text-xs font-semibold uppercase mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>위험 등급 (Risk Level)</label>
                            <div className="flex flex-col gap-2">
                                {['All', 'High', 'Medium', 'Low'].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setActiveRisk(level)}
                                        className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeRisk === level
                                            ? (isDarkMode ? 'bg-yellow-500 text-slate-900' : 'bg-slate-800 text-white')
                                            : (isDarkMode ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                            }`}
                                    >
                                        {level === 'All' ? '전체 보기' : `${level} Risk`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg mt-8 ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={16} className={isDarkMode ? 'text-yellow-400' : 'text-orange-500'} />
                                <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>현재 표시된 데이터</span>
                            </div>
                            <p className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{filteredData.length}<span className="text-sm font-normal text-slate-500 ml-1">건</span></p>
                        </div>
                    </div>
                </div>

                {/* ★ 짤림 방지: div에 h-full w-full을 주고 MapContainer를 position: absolute로 꽉 채웁니다. */}
                <div className={`flex-1 rounded-xl border relative overflow-hidden transition-colors duration-300 h-full ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>

                    <button
                        onClick={moveToMyLocation}
                        className={`absolute top-4 right-4 z-[400] p-3 rounded-full shadow-lg transition-transform hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-yellow-400 border border-slate-700' : 'bg-white text-blue-600 border border-slate-200'
                            }`}
                        title="내 위치로 이동"
                    >
                        <NavIcon size={20} className="fill-current" />
                    </button>

                    <MapContainer center={centerPosition} zoom={13} style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', zIndex: 0 }}>
                        <TileLayer
                            // 배경 지도 타일입니다. 실제 데이터 마커는 아래 CircleMarker들이 담당합니다.
                            url={tileUrl}
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />

                        <MapUpdater center={centerPosition} />

                        {myLocation && (
                            <Marker position={myLocation} icon={redArrowIcon}>
                                <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                                    <div className="font-bold text-slate-800 text-sm p-1">📍 현재 내 위치</div>
                                </LeafletTooltip>
                            </Marker>
                        )}

                        {filteredData.map((d) => (
                            <CircleMarker
                                key={d.id}
                                // Leaflet 좌표 순서는 [lat, lng]입니다.
                                center={[d.lat, d.lng]}
                                radius={12}
                                pathOptions={{
                                    color: getBlobColor(d.riskLevel),
                                    fillColor: getBlobColor(d.riskLevel),
                                    fillOpacity: 0.6,
                                    weight: 0
                                }}
                            >
                                <LeafletTooltip>
                                    <div className="text-xs font-sans p-1">
                                        <strong className="block mb-1 text-sm">{d.type}</strong>
                                        ID: {d.id}
                                    </div>
                                </LeafletTooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>

                    <div className={`absolute bottom-6 right-6 p-3 rounded-lg shadow-lg flex flex-col gap-2 text-xs font-medium border z-[400] ${isDarkMode ? 'bg-slate-800/90 border-slate-700 text-slate-300' : 'bg-white/90 border-slate-200 text-slate-700'} backdrop-blur-sm`}>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div> High Risk</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div> Medium Risk</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div> Low Risk</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Heatmap;

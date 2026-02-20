// adminUI/src/App.tsx 전체 코드

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Database from './views/Database';
import Heatmap from './views/Heatmap';
import HazardModal from './components/HazardModal';
import TestMonitor from './src/pages/TestMonitor';
import { HazardData } from './types';
import { Bell, Search, UserCircle, Sun, Moon } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);
  const [reports, setReports] = useState<HazardData[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [heatmapFocus, setHeatmapFocus] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const mapToHazardData = (dbReport: any): HazardData => {
    let riskLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (dbReport.risk_level >= 4) riskLabel = 'High';
    else if (dbReport.risk_level === 3) riskLabel = 'Medium';

    let currentStatus = dbReport.status || 'New';
    if (currentStatus === 'new') currentStatus = 'New';
    if (currentStatus === 'processing') currentStatus = 'Processing';
    if (currentStatus === 'done') currentStatus = 'Done';

    const dirMap: Record<string, string> = { 'L': '좌측', 'R': '우측', 'C': '정면' };
    const directionStr = dirMap[dbReport.direction] || '정면';

    let lat = dbReport.latitude;
    let lng = dbReport.longitude;
    if (dbReport.location && dbReport.location.coordinates) {
      lng = dbReport.location.coordinates[0];
      lat = dbReport.location.coordinates[1];
    }

    const safeLat = Number(lat || 0).toFixed(6);
    const safeLng = Number(lng || 0).toFixed(6);

    // ★ 404 방지: S3 풀 경로인 경우와 로컬 경로인 경우를 구분합니다.
    const rawImageUrl = dbReport.image_url || '';
    const finalThumbnail = rawImageUrl.startsWith('http')
      ? rawImageUrl
      : `${API_BASE_URL}/${rawImageUrl}`;

    return {
      id: dbReport.item_id,
      type: dbReport.hazard_type,
      riskLevel: riskLabel,
      timestamp: new Date(dbReport.created_at).toLocaleString(),
      rawTimestamp: dbReport.created_at,
      location: `위도: ${safeLat}, 경도: ${safeLng}`,
      coordinates: `거리: ${dbReport.distance}m | 방향: ${directionStr}`,
      distance: dbReport.distance,
      direction: dbReport.direction,
      status: currentStatus as any,
      thumbnail: finalThumbnail,
      description: dbReport.description || "자동 감지 시스템 수집 데이터",
      address: "주소 확인 중...", // 비동기로 채워질 예정
      reporter: "WalkMate AI Camera",
    };
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mappedData = data.map(mapToHazardData);
        setReports(mappedData);

        // ★ 순차적으로 주소를 가져와 업데이트 (Nominatim 무료 API - 초당 1회 제한 권장)
        mappedData.forEach(async (report, index) => {
          setTimeout(async () => {
            try {
              // 위도, 경도는 location 문자열("위도: xx, 경도: yy")에서 추출하거나 원본 데이터 활용
              // 여기서는 mapToHazardData 안에서 계산했던 safeLat, safeLng를 다시 추출
              const coordsStr = report.location;
              const latMatch = coordsStr.match(/위도: ([\d.]+)/);
              const lngMatch = coordsStr.match(/경도: ([\d.]+)/);

              if (latMatch && lngMatch) {
                const lat = latMatch[1];
                const lng = lngMatch[1];
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                const json = await res.json();

                if (json && json.display_name) {
                  // 전체 주소 중 앞부분의 번거로운 국가명 등 제외 후 심플하게 표시
                  const korAddress = json.display_name.split(', ').reverse().slice(1).join(' ');
                  setReports(prev => prev.map(r => r.id === report.id ? { ...r, address: korAddress || "확인 불가" } : r));
                } else {
                  setReports(prev => prev.map(r => r.id === report.id ? { ...r, address: "주소 스캔 실패" } : r));
                }
              }
            } catch (err) {
              setReports(prev => prev.map(r => r.id === report.id ? { ...r, address: "주소 정보 없음" } : r));
            }
          }, index * 1000); // 1초 간격으로 요청하여 API 차단 방지
        });
      }
    } catch (err) { console.error("데이터 로드 실패:", err); }
  }, []);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('app_realtime_reports').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
      const newHazard = mapToHazardData(payload.new);
      setReports((prev) => prev.some(r => r.id === newHazard.id) ? prev : [newHazard, ...prev]);

      // 실시간 데이터도 주소 가져오기
      setTimeout(async () => {
        const coordsStr = newHazard.location;
        const latMatch = coordsStr.match(/위도: ([\d.]+)/);
        const lngMatch = coordsStr.match(/경도: ([\d.]+)/);
        if (latMatch && lngMatch) {
          try {
            const lat = latMatch[1];
            const lng = lngMatch[1];
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const json = await res.json();
            if (json && json.display_name) {
              const korAddress = json.display_name.split(', ').reverse().slice(1).join(' ');
              setReports(prev => prev.map(r => r.id === newHazard.id ? { ...r, address: korAddress || "확인 불가" } : r));
            }
          } catch (e) { }
        }
      }, 500);

    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInitialData]);

  const handleRowClick = (data: HazardData) => setSelectedHazard(data);

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard data={reports} onRowClick={handleRowClick} isDarkMode={isDarkMode} />;
      case 'heatmap': return <Heatmap data={reports} isDarkMode={isDarkMode} initialCenter={heatmapFocus} />;
      case 'database': return <Database data={reports} onRowClick={handleRowClick} />;
      case 'test-monitor': return <TestMonitor />;
      default: return <Dashboard data={reports} onRowClick={handleRowClick} isDarkMode={isDarkMode} />;
    }
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard Overview';
      case 'heatmap': return 'Real-time Hazard Heatmap';
      case 'database': return 'Master Database';
      case 'test-monitor': return 'Real-time Test Monitor';
      default: return 'WalkMate System';
    }
  };

  const handleStatusChange = (newStatus: "new" | "processing" | "done") => {
    if (!selectedHazard) return;

    // Capitalize for internal tracking ('new' -> 'New', 'processing' -> 'Processing', 'done' -> 'Done')
    const capStatus = newStatus === 'done' ? 'Done' : newStatus === 'processing' ? 'Processing' : 'New';

    setReports(prev =>
      prev.map(r => r.id === selectedHazard.id ? { ...r, status: capStatus } : r)
    );
    setSelectedHazard(prev => prev ? { ...prev, status: capStatus } : null);
  };

  const handleViewMap = (hazard: HazardData) => {
    try {
      const latStr = hazard.location.split('위도: ')[1]?.split(',')[0];
      const lngStr = hazard.location.split('경도: ')[1];
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) setHeatmapFocus([lat, lng]);
    } catch { }
    setActivePage('heatmap');
    setSelectedHazard(null); // Close modal
  };

  // Navigating normally from Sidebar should clear the heatmap focus
  useEffect(() => {
    if (activePage !== 'heatmap') {
      setHeatmapFocus(null);
    }
  }, [activePage]);

  return (
    <div className={`flex min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar activePage={activePage} setPage={setActivePage} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className={`h-16 shadow-sm border-b sticky top-0 z-10 flex items-center justify-between px-8 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>HOME</span>
            <span className="mx-2">/</span>
            <span>{getPageTitle()}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-yellow-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className={`flex items-center gap-2 pl-3 border-l cursor-pointer ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="text-right hidden sm:block">
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Admin User</div>
                  <div className="text-xs text-slate-500">Super Administrator</div>
                </div>
                <UserCircle size={32} className="text-slate-400" />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
      <HazardModal
        data={selectedHazard}
        onClose={() => setSelectedHazard(null)}
        onStatusChange={handleStatusChange}
        onViewMap={handleViewMap}
      />
    </div>
  );
};

export default App;
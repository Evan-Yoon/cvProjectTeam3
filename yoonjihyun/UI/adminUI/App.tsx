import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Database from './views/Database';
import Heatmap from './views/Heatmap'; // ★ 새로운 히트맵 컴포넌트 (Reports 대체)
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

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const mapToHazardData = (dbReport: any): HazardData => {
    let riskLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (dbReport.risk_level >= 4) riskLabel = 'High';
    else if (dbReport.risk_level === 3) riskLabel = 'Medium';

    let currentStatus = dbReport.status || 'Pending';
    if (currentStatus === 'new') currentStatus = 'Pending';

    const dirMap: Record<string, string> = { 'L': '좌측', 'R': '우측', 'C': '정면' };
    const directionStr = dirMap[dbReport.direction] || '정면';
    const safeLat = Number(dbReport.latitude || 0).toFixed(4);
    const safeLng = Number(dbReport.longitude || 0).toFixed(4);

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
      thumbnail: `${API_BASE_URL}/${dbReport.image_url}`,
      description: dbReport.description || "자동 감지 시스템 수집 데이터",
      sensorData: { gyro: "N/A", accel: "N/A" },
      reporter: "WalkMate AI Camera",
    };
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (!error && data) setReports(data.map(mapToHazardData));
    } catch (err) { console.error("데이터 로드 실패:", err); }
  }, []);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel('app_realtime_reports').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
      const newHazard = mapToHazardData(payload.new);
      setReports((prev) => prev.some(r => r.id === newHazard.id) ? prev : [newHazard, ...prev]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInitialData]);

  const handleRowClick = (data: HazardData) => setSelectedHazard(data);

  // ★ isDarkMode를 prop으로 넘겨주어 하위 컴포넌트의 테마를 강제로 통제합니다!
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard data={reports} onRowClick={handleRowClick} isDarkMode={isDarkMode} />;
      case 'heatmap': return <Heatmap data={reports} isDarkMode={isDarkMode} />;
      case 'database': return <Database data={reports} onRowClick={handleRowClick} />; // (Database도 추후 isDarkMode 추가 가능)
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
      <HazardModal data={selectedHazard} onClose={() => setSelectedHazard(null)} />
    </div>
  );
};

export default App;
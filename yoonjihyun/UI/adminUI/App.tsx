import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Reports from './views/Reports';
import Database from './views/Database';
import HazardModal from './components/HazardModal';
import TestMonitor from './src/pages/TestMonitor';
import { HazardData } from './types';
import { Bell, Search, UserCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// 1. 환경 변수 및 Supabase 설정
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);

  // ★ [핵심 추가] 전체 앱에서 공유할 실시간 데이터 상태
  const [reports, setReports] = useState<HazardData[]>([]);

  // DB 데이터를 UI 규격(HazardData)으로 변환
  const mapToHazardData = (dbReport: any): HazardData => {
    let riskLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (dbReport.risk_level >= 4) riskLabel = 'High';
    else if (dbReport.risk_level === 3) riskLabel = 'Medium';

    const currentStatus = dbReport.status || 'Pending';
    const dirMap: Record<string, string> = { 'L': '좌측', 'R': '우측', 'C': '정면' };
    const directionStr = dirMap[dbReport.direction] || '정면';

    return {
      id: dbReport.item_id,
      type: dbReport.hazard_type,
      riskLevel: riskLabel,
      timestamp: new Date(dbReport.created_at).toLocaleString(),
      location: `위도: ${dbReport.latitude?.toFixed(4)}, 경도: ${dbReport.longitude?.toFixed(4)}`,
      coordinates: `거리: ${dbReport.distance}m | 방향: ${directionStr}`,
      distance: dbReport.distance,
      direction: dbReport.direction,
      status: currentStatus,
      thumbnail: `${API_BASE_URL}/${dbReport.image_url}`,
      description: dbReport.description || "자동 감지 시스템 수집 데이터",
      sensorData: { gyro: "N/A", accel: "N/A" },
      reporter: "WalkMate AI Camera",
    };
  };

  // ---------------------------------------------------------------------------
  // 2. 데이터 페칭 및 실시간 구독 로직
  // ---------------------------------------------------------------------------
  const fetchInitialData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setReports(data.map(mapToHazardData));
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    }
  }, []);

  useEffect(() => {
    // 앱이 처음 켜질 때 1회 로드
    fetchInitialData();

    // Supabase Realtime 구독
    const channel = supabase
      .channel('app_realtime_reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const newHazard = mapToHazardData(payload.new);
          setReports((prev) => {
            if (prev.some(r => r.id === newHazard.id)) return prev;
            return [newHazard, ...prev]; // 최신 데이터 맨 앞에 추가
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  const handleRowClick = (data: HazardData) => {
    setSelectedHazard(data);
  };

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        // ★ 부모가 가진 reports 데이터를 자식에게 props로 전달
        return <Dashboard data={reports} onRowClick={handleRowClick} />;
      case 'reports-b2b':
        return <Reports data={reports} type="B2B" onRowClick={handleRowClick} />;
      case 'reports-b2g':
        return <Reports data={reports} type="B2G" onRowClick={handleRowClick} />;
      case 'database':
        return <Database data={reports} onRowClick={handleRowClick} />;
      case 'test-monitor':
        // TestMonitor는 자체적으로 데이터를 호출하는 구조를 유지
        return <TestMonitor />;
      default:
        return <Dashboard data={reports} onRowClick={handleRowClick} />;
    }
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard Overview';
      case 'reports-b2b': return 'B2B Hazard Reports';
      case 'reports-b2g': return 'B2G Hazard Reports';
      case 'database': return 'Master Database';
      case 'test-monitor': return 'Real-time Test Monitor';
      default: return 'WalkMate System';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <Sidebar activePage={activePage} setPage={setActivePage} />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">

        {/* Top Header */}
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="flex items-center text-slate-500 text-sm">
            <span className="font-semibold text-slate-700">HOME</span>
            <span className="mx-2">/</span>
            <span>{getPageTitle()}</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <input
                type="text"
                placeholder="Search..."
                className="pl-4 pr-10 py-1.5 rounded-full bg-slate-100 border-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all text-sm w-64"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200 cursor-pointer">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-slate-800">Admin User</div>
                  <div className="text-xs text-slate-500">Super Administrator</div>
                </div>
                <UserCircle size={32} className="text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* Detail Modal Popup */}
      <HazardModal
        data={selectedHazard}
        onClose={() => setSelectedHazard(null)}
      />
    </div>
  );
};

export default App;
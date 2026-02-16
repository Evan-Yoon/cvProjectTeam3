import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Reports from './views/Reports';
import Database from './views/Database';
import HazardModal from './components/HazardModal';
// ★ [추가] 방금 만든 TestMonitor 페이지 import
import TestMonitor from './src/pages/TestMonitor';
import { HazardData } from './types';
import { Bell, Search, UserCircle } from 'lucide-react';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);

  const handleRowClick = (data: HazardData) => {
    setSelectedHazard(data);
  };

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onRowClick={handleRowClick} />;
      case 'reports-b2b':
        return <Reports type="B2B" onRowClick={handleRowClick} />;
      case 'reports-b2g':
        return <Reports type="B2G" onRowClick={handleRowClick} />;
      case 'database':
        return <Database onRowClick={handleRowClick} />;

      // ★ [추가] test-monitor 상태일 때 보여줄 컴포넌트 설정
      case 'test-monitor':
        return <TestMonitor />;

      default:
        return <Dashboard onRowClick={handleRowClick} />;
    }
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard Overview';
      case 'reports-b2b': return 'B2B Hazard Reports';
      case 'reports-b2g': return 'B2G Hazard Reports';
      case 'database': return 'Master Database';

      // ★ [추가] 상단 헤더 제목 설정
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
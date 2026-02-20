import React from 'react';
import { LayoutDashboard, Database, LogOut, Camera, Map } from 'lucide-react'; // ★ Map 아이콘 추가

interface SidebarProps {
  activePage: string;
  setPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setPage }) => {
  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={20} /> },
    { id: 'heatmap', label: '위험 히트맵', icon: <Map size={20} /> }, // ★ 리포트 삭제 및 히트맵 추가
    { id: 'database', label: '마스터 DB', icon: <Database size={20} /> },
    { id: 'test-monitor', label: '실시간 모니터링', icon: <Camera size={20} /> },
  ];

  return (
    <div className="w-64 bg-white text-slate-800 h-screen fixed left-0 top-0 flex flex-col border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
      <div
        className="p-5 border-b border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setPage('dashboard')}
      >
        <img
          src="/walkmate_logo.png"
          alt="WalkMate Logo"
          className="w-full max-w-[180px] h-auto object-contain transition-transform hover:scale-105"
        />
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${activePage === item.id
              ? 'bg-yellow-500 text-slate-900 font-bold shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <span className={activePage === item.id ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
          <LogOut size={20} />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
import React from 'react';
import { LayoutDashboard, FileText, Database, LogOut, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setPage }) => {
  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={20} /> },
    { id: 'reports-b2b', label: 'B2B 리포트', icon: <FileText size={20} /> },
    { id: 'reports-b2g', label: 'B2G 리포트', icon: <FileText size={20} /> },
    { id: 'database', label: '마스터 DB', icon: <Database size={20} /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col shadow-xl z-20">
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-500/20">
          <ShieldCheck size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight text-white">WalkMate</h1>
          <p className="text-xs text-slate-400">Admin System</p>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${activePage === item.id
                ? 'bg-yellow-500 text-slate-900 font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <span className={activePage === item.id ? 'text-slate-900' : 'text-slate-400 group-hover:text-white'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors">
          <LogOut size={20} />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
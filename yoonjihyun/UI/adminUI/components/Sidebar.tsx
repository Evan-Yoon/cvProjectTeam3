import React from 'react';
import { LayoutDashboard, Database, LogOut, Map, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setPage: (page: string) => void;
  isDarkMode?: boolean;
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  setPage,
  isDarkMode = false,
  isOpen = true,
  setIsOpen
}) => {
  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={20} /> },
    { id: 'heatmap', label: '위험 히트맵', icon: <Map size={20} /> },
    { id: 'database', label: '마스터 DB', icon: <Database size={20} /> },
  ];

  // 로고랑 어울리는 아주 어두운 색상 (다크 모드일 때)
  const sidebarWidth = isOpen ? 'w-64' : 'w-20';
  const bgColor = isDarkMode ? 'bg-[#1A1A1A] border-slate-800' : 'bg-white border-slate-200';
  const textColor = isDarkMode ? 'text-slate-300' : 'text-slate-800';

  return (
    <div className={`${sidebarWidth} ${bgColor} ${textColor} h-screen fixed left-0 top-0 flex flex-col border-r shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300`}>
      <div
        className={`p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} flex items-center ${isOpen ? 'justify-between' : 'justify-center'} cursor-pointer hover:${isDarkMode ? 'bg-[#222]' : 'bg-slate-50'} transition-colors relative min-h-[80px]`}
      >
        <div
          onClick={() => setPage('dashboard')}
          className="flex items-center justify-center w-full overflow-hidden"
          title={!isOpen ? "WalkMate 로고" : undefined}
        >
          {isOpen ? (
            <img
              src="/walkmate_logo.png"
              alt="WalkMate Logo"
              className="w-full max-w-[160px] h-auto object-contain transition-transform hover:scale-105"
              style={{ filter: isDarkMode ? 'brightness(1.5) contrast(1.2)' : 'none' }}
            />
          ) : (
            <img
              src="/walkmate_logo.png"
              alt="WalkMate Logo"
              className="w-full max-h-8 object-contain object-left transition-transform hover:scale-105"
              style={{ filter: isDarkMode ? 'brightness(1.5) contrast(1.2)' : 'none', maxWidth: '32px', overflow: 'hidden' }}
            />
          )}
        </div>

        {/* 열기/닫기 토글 버튼 */}
        {setIsOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className={`absolute ${isOpen ? 'right-2' : '-right-3 top-1/2 -translate-y-1/2'} p-1 rounded-full border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 z-30 shadow-sm'}`}
          >
            {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const isActive = activePage === item.id;
          const normalClass = isDarkMode
            ? 'text-slate-400 hover:bg-[#2A2A2A] hover:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
          const activeClass = 'bg-yellow-500 text-slate-900 font-bold shadow-sm';

          return (
            <button
              key={item.id}
              title={!isOpen ? item.label : undefined}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center ${isOpen ? 'px-4 pl-3' : 'justify-center px-0'} py-3 rounded-lg transition-all duration-200 group ${isActive ? activeClass : normalClass}`}
            >
              <span className={`${isActive ? 'text-slate-900' : (isDarkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-600')} transition-colors`}>
                {item.icon}
              </span>
              {isOpen && <span className="ml-3 whitespace-nowrap">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          className={`w-full flex items-center ${isOpen ? 'px-4 pl-3' : 'justify-center px-0'} py-3 rounded-lg ${isDarkMode ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-500 hover:bg-red-50 hover:text-red-600'} transition-colors font-medium`}
          title={!isOpen ? '로그아웃' : undefined}
        >
          <LogOut size={20} />
          {isOpen && <span className="ml-3 whitespace-nowrap">로그아웃</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
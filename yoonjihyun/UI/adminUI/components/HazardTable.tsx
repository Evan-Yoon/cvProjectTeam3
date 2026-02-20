import React from 'react';
import { HazardData } from '../types';
import { Eye, AlertTriangle } from 'lucide-react';

interface HazardTableProps {
  data: HazardData[];
  onRowClick: (hazard: HazardData) => void;
  compact?: boolean;
  isDarkMode?: boolean; // ★ 테마 상태를 명시적으로 받음
}

const HazardTable: React.FC<HazardTableProps> = ({ data, onRowClick, compact = false, isDarkMode = false }) => {
  const getRiskBadge = (level: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors duration-300";
    if (level === 'High') return `${base} ${isDarkMode ? 'bg-red-900/30 text-red-400 border-red-800/50' : 'bg-red-100 text-red-800 border-red-200'}`;
    if (level === 'Medium') return `${base} ${isDarkMode ? 'bg-orange-900/30 text-orange-400 border-orange-800/50' : 'bg-orange-100 text-orange-800 border-orange-200'}`;
    return `${base} ${isDarkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800/50' : 'bg-blue-100 text-blue-800 border-blue-200'}`;
  };

  return (
    <div className={`overflow-x-auto rounded-lg border shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <table className="w-full text-sm text-left">
        <thead className={`uppercase text-xs font-semibold transition-colors duration-300 ${isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
          <tr>
            <th className="px-6 py-4">썸네일</th>
            <th className="px-6 py-4">위험 등급</th>
            <th className="px-6 py-4">ID / 유형</th>
            {!compact && <th className="px-6 py-4">발생 시간</th>}
            {!compact && <th className="px-6 py-4">위치</th>}
            <th className="px-6 py-4">상태</th>
            <th className="px-6 py-4 text-right">관리</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick(item)}
              className={`cursor-pointer transition-colors group ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}
            >
              <td className="px-6 py-3">
                <div className={`relative w-12 h-12 rounded overflow-hidden shadow-sm border transition-colors duration-300 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'} bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
                  <img
                    src={item.thumbnail}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 403 에러 등으로 이미지가 깨질 때 플레이스홀더로 대체
                      (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=No+Image';
                    }}
                  />
                </div>
              </td>
              <td className="px-6 py-3">
                <span className={getRiskBadge(item.riskLevel)}>{item.riskLevel}</span>
              </td>
              <td className="px-6 py-3">
                <div className={`font-medium transition-colors duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{item.id}</div>
                <div className={`text-xs mt-0.5 transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.type}</div>
              </td>
              {!compact && (
                <td className={`px-6 py-3 whitespace-nowrap transition-colors duration-300 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {item.timestamp.split(' ')[0]}<br />
                  <span className={`text-xs transition-colors duration-300 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.timestamp.split(' ')[1]}</span>
                </td>
              )}
              {!compact && (
                <td className={`px-6 py-3 truncate max-w-xs transition-colors duration-300 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} title={item.location}>
                  {item.location}
                </td>
              )}
              <td className="px-6 py-3">
                <span className={`text-xs font-semibold transition-colors duration-300 flex items-center gap-1 ${item.status === 'Resolved' ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                  item.status === 'In Progress' ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600') :
                    (isDarkMode ? 'text-red-400' : 'text-red-500')
                  }`}>
                  {item.status === 'Pending' && <AlertTriangle size={12} />}
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-3 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowClick(item);
                  }}
                  className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200'}`}
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className={`p-8 text-center transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
};

export default HazardTable;
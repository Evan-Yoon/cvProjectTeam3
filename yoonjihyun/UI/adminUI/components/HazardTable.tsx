import React from 'react';
import { HazardData } from '../types';
import { Eye, AlertTriangle } from 'lucide-react';

interface HazardTableProps {
  data: HazardData[];
  onRowClick: (hazard: HazardData) => void;
  compact?: boolean;
}

const HazardTable: React.FC<HazardTableProps> = ({ data, onRowClick, compact = false }) => {
  // ★ 다크모드 배지 색상 대응
  const getRiskBadge = (level: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors duration-300";
    if (level === 'High') return `${base} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50`;
    if (level === 'Medium') return `${base} bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800/50`;
    return `${base} bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50`;
  };

  return (
    // ★ 전체 배경 및 테두리 다크모드 대응
    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
      <table className="w-full text-sm text-left">
        {/* ★ 테이블 헤더 다크모드 대응 */}
        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold transition-colors duration-300">
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
        {/* ★ 테이블 바디 줄 간격 선 다크모드 대응 */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick(item)}
              // ★ 행(Row) 호버 시 다크모드 대응
              className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
            >
              <td className="px-6 py-3">
                <div className="relative w-12 h-12 rounded overflow-hidden shadow-sm border border-slate-200 dark:border-slate-600 transition-colors duration-300">
                  <img src={item.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                </div>
              </td>
              <td className="px-6 py-3">
                <span className={getRiskBadge(item.riskLevel)}>{item.riskLevel}</span>
              </td>
              <td className="px-6 py-3">
                {/* ★ 텍스트 다크모드 대응 */}
                <div className="font-medium text-slate-900 dark:text-slate-200 transition-colors duration-300">{item.id}</div>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 transition-colors duration-300">{item.type}</div>
              </td>
              {!compact && (
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap transition-colors duration-300">
                  {item.timestamp.split(' ')[0]}<br />
                  <span className="text-xs text-slate-400 dark:text-slate-500 transition-colors duration-300">{item.timestamp.split(' ')[1]}</span>
                </td>
              )}
              {!compact && (
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300 truncate max-w-xs transition-colors duration-300" title={item.location}>
                  {item.location}
                </td>
              )}
              <td className="px-6 py-3">
                <span className={`text-xs font-semibold transition-colors duration-300 ${item.status === 'Resolved' ? 'text-green-600 dark:text-green-400' :
                    item.status === 'In Progress' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-500 dark:text-red-400 flex items-center gap-1'
                  }`}>
                  {item.status === 'Pending' && <AlertTriangle size={12} />}
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-3 text-right">
                {/* ★ 액션 아이콘 호버 다크모드 대응 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowClick(item);
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-full transition-all"
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 transition-colors duration-300">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
};

export default HazardTable;
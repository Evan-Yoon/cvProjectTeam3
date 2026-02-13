import React from 'react';
import { HazardData } from '../types';
import { Eye, AlertTriangle } from 'lucide-react';

interface HazardTableProps {
  data: HazardData[];
  onRowClick: (hazard: HazardData) => void;
  compact?: boolean;
}

const HazardTable: React.FC<HazardTableProps> = ({ data, onRowClick, compact = false }) => {
  const getRiskBadge = (level: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-medium border";
    if (level === 'High') return `${base} bg-red-100 text-red-800 border-red-200`;
    if (level === 'Medium') return `${base} bg-orange-100 text-orange-800 border-orange-200`;
    return `${base} bg-blue-100 text-blue-800 border-blue-200`;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
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
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick(item)}
              className="hover:bg-slate-50 cursor-pointer transition-colors group"
            >
              <td className="px-6 py-3">
                <div className="relative w-12 h-12 rounded overflow-hidden shadow-sm border border-slate-200">
                  <img src={item.thumbnail} alt="thumbnail" className="w-full h-full object-cover" />
                </div>
              </td>
              <td className="px-6 py-3">
                <span className={getRiskBadge(item.riskLevel)}>{item.riskLevel}</span>
              </td>
              <td className="px-6 py-3">
                <div className="font-medium text-slate-900">{item.id}</div>
                <div className="text-slate-500 text-xs mt-0.5">{item.type}</div>
              </td>
              {!compact && (
                <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                  {item.timestamp.split(' ')[0]}<br />
                  <span className="text-xs text-slate-400">{item.timestamp.split(' ')[1]}</span>
                </td>
              )}
              {!compact && (
                <td className="px-6 py-3 text-slate-600 truncate max-w-xs" title={item.location}>
                  {item.location}
                </td>
              )}
              <td className="px-6 py-3">
                <span className={`text-xs font-semibold ${item.status === 'Resolved' ? 'text-green-600' :
                    item.status === 'In Progress' ? 'text-yellow-600' :
                      'text-red-500 flex items-center gap-1'
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
                  className="text-slate-400 hover:text-slate-900 hover:bg-slate-200 p-2 rounded-full transition-all"
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
};

export default HazardTable;
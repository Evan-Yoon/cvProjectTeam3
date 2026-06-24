import React from 'react';
import { HazardData } from '../types';
import { Eye, AlertTriangle } from 'lucide-react';

interface HazardTableProps {
  // 표시할 신고 목록입니다. Dashboard에서는 최근 5개, Database에서는 페이지네이션 결과가 들어옵니다.
  data: HazardData[];
  onRowClick: (hazard: HazardData) => void;
  // compact=true면 체크박스/일부 컬럼을 숨겨 대시보드용 미니 테이블로 사용합니다.
  compact?: boolean;
  isDarkMode?: boolean; // ★ 테마 상태를 명시적으로 받음
  // Database 화면에서 선택 삭제/선택 CSV 내보내기에 쓰는 선택 상태입니다.
  selectedIds?: Set<string>;
  onSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

const HazardTable: React.FC<HazardTableProps> = ({
  data,
  onRowClick,
  compact = false,
  isDarkMode = false,
  selectedIds = new Set<string>(),
  onSelect,
  onSelectAll
}) => {
  const getRiskBadge = (level: string) => {
    // 위험도 문자열에 따라 배지 색상을 결정합니다.
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
            {!compact && (
              <th className="px-6 py-4 w-12">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  // 현재 페이지의 모든 행이 선택된 경우 전체 선택 체크박스를 켭니다.
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                />
              </th>
            )}
            <th className="px-6 py-4">썸네일</th>
            <th className="px-6 py-4">위험 등급</th>
            <th className="px-6 py-4">ID / 유형</th>
            {!compact && <th className="px-6 py-4">발생일</th>}
            {!compact && <th className="px-6 py-4">발생 시간</th>}
            {!compact && <th className="px-6 py-4">위치</th>}
            <th className="px-6 py-4">상태</th>
            <th className="px-6 py-4 text-right">자세히 보기</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
          {data.map((item) => (
            <tr
              key={item.id}
              // 행 전체 클릭은 상세 모달 열기입니다.
              onClick={() => onRowClick(item)}
              className={`cursor-pointer transition-colors group ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} ${selectedIds.has(item.id) ? (isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
            >
              {!compact && (
                <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={selectedIds.has(item.id)}
                    // 체크박스 클릭은 행 클릭과 별도 동작이므로 td에서 이벤트 전파를 막습니다.
                    onChange={(e) => onSelect?.(item.id, e.target.checked)}
                  />
                </td>
              )}
              <td className="px-6 py-3">
                <div className={`relative w-12 h-12 rounded overflow-hidden shadow-sm border transition-colors duration-300 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'} bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
                  <img
                    src={item.thumbnail}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 403 에러 등으로 이미지가 깨질 때 플레이스홀더로 대체
                      // S3 객체 공개 정책이 없거나 URL이 만료되면 여기로 들어올 수 있습니다.
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
                <>
                  <td className={`px-6 py-3 whitespace-nowrap transition-colors duration-300 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {item.timestamp.split(' ')[0]}
                  </td>
                  <td className={`px-6 py-3 whitespace-nowrap transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.timestamp.split(' ').slice(1).join(' ')}
                  </td>
                </>
              )}
              {!compact && (
                <td className={`px-6 py-3 truncate max-w-xs transition-colors duration-300 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} title={item.location}>
                  {item.location}
                </td>
              )}
              <td className="px-6 py-3">
                <span className={`text-xs font-semibold transition-colors duration-300 flex items-center gap-1 ${item.status === 'Done' ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                  item.status === 'Processing' ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600') :
                    (isDarkMode ? 'text-red-400' : 'text-red-500')
                  }`}>
                  {item.status === 'New' && <AlertTriangle size={12} />}
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-3 text-right">
                <button
                  onClick={(e) => {
                    // 버튼 클릭이 tr onClick까지 전파되면 모달 열기 로직이 중복 실행될 수 있어 막습니다.
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

import React, { useState, useMemo, useEffect } from 'react';
import { HazardData } from '../types';
import HazardTable from '../components/HazardTable';
import { Download, Upload, Database as DbIcon, Trash2 } from 'lucide-react';
import { deleteReport } from '../src/api/adminApi';

interface DatabaseProps {
  // 전체 신고 데이터입니다. 이 컴포넌트 안에서 필터/정렬/페이지네이션을 적용합니다.
  data: HazardData[];
  onRowClick: (data: HazardData) => void;
  // 삭제 후 서버 데이터를 다시 불러오기 위한 선택 콜백입니다.
  onRefreshData?: () => void;
  isDarkMode?: boolean;
}

const Database: React.FC<DatabaseProps> = ({ data, onRowClick, onRefreshData, isDarkMode = false }) => {
  // 필터와 정렬 상태입니다. 값이 바뀌면 useMemo가 filteredAndSortedData를 다시 계산합니다.
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD format from input
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 선택 삭제/선택 내보내기를 위해 선택된 row id를 Set으로 관리합니다.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const downloadCSV = (items: HazardData[], filename: string) => {
    // CSV 내보내기는 현재 브라우저에서 파일 Blob을 만들고, 임시 a 태그를 클릭해 다운로드합니다.
    if (items.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }
    const headers = ["ID", "위험 등급", "발생일", "발생 시간", "위치 좌표", "상태", "상세 내용"];
    const rows = items.map(item => [
      item.id,
      item.riskLevel,
      item.timestamp.split(' ')[0], // Date
      item.timestamp.split(' ').slice(1).join(' '), // Time
      // CSV에서 쉼표/쌍따옴표가 있는 필드는 큰따옴표로 감싸고 내부 따옴표를 2개로 escape합니다.
      `"${item.location.replace(/"/g, '""')}"`, // Handle commas in location
      item.status,
      `"${item.description?.replace(/"/g, '""') || ''}"` // Handle commas in description
    ]);

    // Create CSV string with BOM for Excel UTF-8 compatibility
    // \uFEFF BOM을 앞에 붙이면 Excel에서 한글 UTF-8 CSV를 더 잘 인식합니다.
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // URL.revokeObjectURL을 호출하면 메모리 회수가 더 명확하지만, 현재 파일 크기가 작아 큰 문제는 없습니다.
  };

  // Filters change -> Reset to page 1
  useEffect(() => {
    // 필터/정렬/페이지 크기가 바뀌면 현재 페이지가 범위를 벗어날 수 있으므로 1페이지로 돌립니다.
    setCurrentPage(1);
  }, [statusFilter, riskFilter, dateFilter, sortOrder, itemsPerPage]);

  const filteredAndSortedData = useMemo(() => {
    // props.data를 직접 mutate하지 않기 위해 복사본을 만듭니다.
    let result = [...data];

    if (statusFilter !== 'All') {
      result = result.filter(h => h.status === statusFilter);
    }
    if (riskFilter !== 'All') {
      result = result.filter(h => h.riskLevel === riskFilter);
    }
    if (dateFilter) {
      const formattedDateFilter = dateFilter.replace(/-/g, '.'); // 2026-02-20 -> 2026.02.20
      // App.tsx에서 timestamp를 2026.02.20 오전... 형식으로 만들었기 때문에 input date 형식을 맞춰 비교합니다.
      result = result.filter(h => h.timestamp.split(' ')[0] === formattedDateFilter);
    }

    result.sort((a, b) => {
      // rawTimestamp가 있으면 원본 DB 시간으로 정렬합니다.
      const timeA = new Date(a.rawTimestamp || '').getTime();
      const timeB = new Date(b.rawTimestamp || '').getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [data, statusFilter, riskFilter, dateFilter, sortOrder]);

  // 현재 필터 결과에서 현재 페이지에 보여줄 데이터만 잘라냅니다.
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage) || 1;
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelect = (id: string, selected: boolean) => {
    // Set은 직접 수정하면 React가 변경을 감지하기 어려우므로 새 Set을 만들어 반환합니다.
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      // 전체 선택은 "현재 페이지"에 보이는 항목만 선택합니다.
      setSelectedIds(new Set(paginatedData.map((d: HazardData) => String(d.id))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 항목을 정말 삭제(숨김) 처리하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      // 선택된 모든 id에 대해 DELETE 요청을 병렬 실행합니다.
      const deletePromises = Array.from(selectedIds).map((id: string) => deleteReport(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      if (onRefreshData) onRefreshData(); // App.tsx의 fetchInitialData 재호출
      else alert('삭제(숨김) 처리가 완료되었습니다. 새로고침 시 반영됩니다.');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('일부 항목 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className={`text-2xl font-bold flex items-center gap-2 transition-colors ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            <DbIcon className={isDarkMode ? "text-slate-500" : "text-slate-400"} />
            WalkMate 마스터 데이터베이스
          </h2>
          <p className={`mt-1 transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            시스템에 등록된 모든 실시간 위험 데이터를 조회하고 관리합니다.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 text-sm font-bold border border-red-200 rounded-lg hover:bg-red-200 transition-colors mr-2 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {isDeleting ? '삭제 중...' : `${selectedIds.size}개 항목 삭제`}
            </button>
          )}
          <div className="flex items-center gap-2 mr-4">
            <span className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>정렬기준:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className={`text-sm border rounded-lg px-2 py-1 outline-none transition-colors focus:ring-2 focus:ring-blue-500 cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
            >
              <option value="desc">최신순</option>
              <option value="asc">과거순</option>
            </select>

            <span className={`text-sm font-medium ml-2 transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>목록 개수:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className={`text-sm border rounded-lg px-2 py-1 outline-none transition-colors focus:ring-2 focus:ring-blue-500 cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
            >
              <option value={5}>5개 보기</option>
              <option value={10}>10개 보기</option>
              <option value={20}>20개 보기</option>
            </select>
          </div>

          {selectedIds.size > 0 ? (
            <button
              onClick={() => {
                // 선택 내보내기는 전체 필터 결과 중 선택된 id만 다시 골라 CSV로 만듭니다.
                const selectedData = filteredAndSortedData.filter(d => selectedIds.has(String(d.id)));
                downloadCSV(selectedData, `walkmate_selected_reports_${new Date().toISOString().slice(0, 10)}`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={16} /> 선택 데이터 내보내기
            </button>
          ) : (
            <button
              onClick={() => downloadCSV(filteredAndSortedData, `walkmate_reports_${new Date().toISOString().slice(0, 10)}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={16} /> 전체 내보내기
            </button>
          )}
        </div>
      </div>

      <div className={`p-4 rounded-lg shadow-sm border flex flex-wrap items-center gap-6 transition-colors ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* 상태 필터 */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>상태:</span>
          <div className="flex gap-2">
            {['All', 'New', 'Processing', 'Done'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === status
                  ? 'bg-blue-600 text-white font-medium'
                  : isDarkMode
                    ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {status === 'All' ? '전체' : status}
              </button>
            ))}
          </div>
        </div>

        <div className={`w-px h-6 hidden sm:block ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

        {/* 빈도/등급 필터 */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>위험 등급:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className={`text-sm border rounded-lg px-3 py-1.5 outline-none transition-colors focus:ring-2 focus:ring-blue-500 cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
          >
            <option value="All">전체</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className={`w-px h-6 hidden sm:block ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

        {/* 날짜 필터 */}
        <div className={`flex items-center gap-3 border rounded-lg px-3 py-1 transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-400'
          }`}>
          <span className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>날짜:</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`text-sm bg-transparent outline-none cursor-pointer transition-colors ${isDarkMode ? '[color-scheme:dark] text-slate-200' : 'text-slate-700'}`}
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className={`text-xs font-semibold hover:underline px-2 py-0.5 rounded transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300 bg-blue-900/30' : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                }`}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <HazardTable
        // 테이블에는 이미 페이지네이션이 적용된 데이터만 전달합니다.
        data={paginatedData}
        onRowClick={onRowClick}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        isDarkMode={isDarkMode}
      />

      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <nav className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${pageNum === currentPage
                    ? 'bg-blue-600 text-white border-blue-600'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};

export default Database;

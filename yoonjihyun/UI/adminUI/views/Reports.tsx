import React, { useState } from 'react';
import { HazardData, ReportType } from '../types';
import HazardTable from '../components/HazardTable';
import { Search, Filter } from 'lucide-react';

interface ReportsProps {
  data: HazardData[]; // ★ 추가
  type: ReportType;
  onRowClick: (data: HazardData) => void;
}

const Reports: React.FC<ReportsProps> = ({ data, type, onRowClick }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 현재 DB에 reportType이 명확히 구분되어 있지 않을 수 있으므로,
  // 일단 방어적으로 검색어 필터링만 유지하거나 향후 B2B/B2G 데이터가 분리될 때 사용합니다.
  const filteredData = data.filter(item =>
    (item.reportType === type || !item.reportType) && // reportType이 없는 데이터도 일단 보여줌
    (item.location.includes(searchTerm) || item.type.includes(searchTerm) || item.id.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{type} 위험 관리 리포트</h2>
          <p className="text-slate-500">
            {type === 'B2B' ? '기업 고객 (Corporate) 관련 실시간 신고 내역입니다.' : '정부/지자체 (Government) 관련 실시간 신고 내역입니다.'}
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="검색 (ID, 위치, 유형)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 w-64"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700">
            <Filter size={16} />
            <span>필터</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <span className="text-sm font-semibold text-slate-700">총 {filteredData.length}건의 리포트</span>
          <div className="flex gap-2 text-xs">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded shadow-sm">Excel 다운로드</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded shadow-sm">PDF 인쇄</button>
          </div>
        </div>
        <HazardTable data={filteredData} onRowClick={onRowClick} />
      </div>
    </div>
  );
};

export default Reports;
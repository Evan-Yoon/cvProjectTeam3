import React, { useState } from 'react';
import { HazardData } from '../types';
import HazardTable from '../components/HazardTable';
import { Download, Upload, Database as DbIcon } from 'lucide-react';

interface DatabaseProps {
  data: HazardData[]; // ★ 추가
  onRowClick: (data: HazardData) => void;
}

const Database: React.FC<DatabaseProps> = ({ data, onRowClick }) => {
  const [filter, setFilter] = useState('All');

  // 전달받은 실제 데이터를 필터링
  const filteredData = filter === 'All'
    ? data
    : data.filter(h => h.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DbIcon className="text-slate-400" />
            WalkMate 마스터 데이터베이스
          </h2>
          <p className="text-slate-500 mt-1">시스템에 등록된 모든 실시간 위험 데이터를 조회하고 관리합니다.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
            <Upload size={16} /> CSV 가져오기
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={16} /> 전체 내보내기
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">상태 필터:</span>
        <div className="flex gap-2">
          {['All', 'New', 'Processing', 'Done'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${filter === status
                ? 'bg-slate-800 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {status === 'All' ? '전체' : status}
            </button>
          ))}
        </div>
      </div>

      <HazardTable data={filteredData} onRowClick={onRowClick} />

      {/* 데이터가 많아지면 실제 Pagination 로직 연결이 필요합니다. */}
      {filteredData.length > 0 && (
        <div className="flex justify-center mt-6">
          <nav className="flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">1</button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default Database;
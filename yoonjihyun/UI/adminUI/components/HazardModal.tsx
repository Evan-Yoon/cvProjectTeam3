import React from 'react';
import { HazardData } from '../types';
import { X, MapPin, Calendar, Activity, User, FileText, Server } from 'lucide-react';

interface HazardModalProps {
  data: HazardData | null;
  onClose: () => void;
}

const HazardModal: React.FC<HazardModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  // 1. 위험도(Risk Level) 색상 결정 함수 (다크모드 색상 추가)
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50';
      case 'Medium': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800/50';
      case 'Low': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  // 2. 상태(Status) 색상 및 라벨 결정 (다크모드 색상 추가)
  let statusColor = '';
  let statusLabel = '';

  switch (data.status) {
    case 'Resolved':
      statusColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
      statusLabel = '해결됨 (Resolved)';
      break;
    case 'In Progress':
      statusColor = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
      statusLabel = '처리 중 (In Progress)';
      break;
    case 'Pending':
    default:
      statusColor = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
      statusLabel = '접수됨 (Pending)';
      break;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose} // 바깥 영역 클릭 시 모달 닫기
    >
      {/* 모달 박스 메인 */}
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden border dark:border-slate-700 transition-colors duration-300"
        onClick={(e) => e.stopPropagation()} // 내부 클릭 시 닫히지 않도록 이벤트 전파 막기
      >

        {/* 왼쪽: 이미지 영역 */}
        <div className="w-full md:w-1/2 bg-gray-100 dark:bg-slate-800 relative min-h-[300px] md:min-h-auto flex items-center justify-center">
          <img
            src={data.thumbnail}
            alt={data.type}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=No+Image+(403+Forbidden)';
            }}
          />
          <div className="absolute top-4 left-4">
            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getRiskColor(data.riskLevel)} shadow-sm backdrop-blur-md`}>
              {data.riskLevel} Risk
            </span>
          </div>
        </div>

        {/* 오른쪽: 상세 정보 영역 */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">

          {/* 헤더: 제목 및 닫기 버튼 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-colors duration-300">{data.type}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors duration-300">ID: {data.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* 본문 내용 */}
          <div className="space-y-6 flex-1">

            {/* 상세 설명 박스 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
                상세 설명
              </h3>
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{data.description}</p>
            </div>

            {/* 정보 그리드 (2열) */}
            <div className="grid grid-cols-2 gap-4">

              {/* 위치 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  <MapPin className="w-3 h-3 mr-1" /> 위치
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words">{data.location}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{data.coordinates}</div>
              </div>

              {/* 발생 시간 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  <Calendar className="w-3 h-3 mr-1" /> 발생 시간
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.timestamp}</div>
              </div>

              {/* 상태 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  <Activity className="w-3 h-3 mr-1" /> 상태
                </div>
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* 센서 데이터 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  <Server className="w-3 h-3 mr-1" /> 센서 데이터
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                  Gyro: {data.sensorData.gyro}<br />
                  Accel: {data.sensorData.accel}
                </div>
              </div>
            </div>

            {/* 신고자 정보 */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                <User className="w-3 h-3 mr-1" /> 신고자 / 감지기
              </div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.reporter}</div>
            </div>

          </div>

          {/* 하단 버튼 영역 */}
          <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
            <button className="flex-1 bg-slate-900 dark:bg-yellow-500 hover:bg-slate-800 dark:hover:bg-yellow-400 text-white dark:text-slate-900 py-2.5 px-4 rounded-lg text-sm font-bold transition-colors">
              조치 보고서 작성
            </button>
            <button className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors">
              위치 지도 보기
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HazardModal;
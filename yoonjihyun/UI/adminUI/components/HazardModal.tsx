import React from 'react';
import { HazardData } from '../types'; // types.ts 경로가 맞는지 확인해주세요
import { X, MapPin, Calendar, Activity, User, FileText, Server } from 'lucide-react';

interface HazardModalProps {
  data: HazardData | null;
  onClose: () => void;
}

const HazardModal: React.FC<HazardModalProps> = ({ data, onClose }) => {
  // 데이터가 없으면 아무것도 그리지 않음
  if (!data) return null;

  // 1. 위험도(Risk Level) 색상 결정 함수
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 2. ★ 상태(Status) 색상 및 라벨 미리 계산 (오류 수정 부분) ★
  let statusColor = '';
  let statusLabel = '';

  switch (data.status) {
    case 'Resolved':
      statusColor = 'bg-green-100 text-green-800';
      statusLabel = '해결됨 (Resolved)';
      break;
    case 'In Progress':
      statusColor = 'bg-yellow-100 text-yellow-800';
      statusLabel = '처리 중 (In Progress)';
      break;
    case 'Pending':
    default:
      statusColor = 'bg-red-100 text-red-800';
      statusLabel = '접수됨 (Pending)';
      break;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">

      {/* 모달 박스 */}
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* 왼쪽: 이미지 영역 */}
        <div className="w-full md:w-1/2 bg-gray-100 relative min-h-[300px] md:min-h-auto">
          <img
            src={data.thumbnail}
            alt={data.type}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4">
            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getRiskColor(data.riskLevel)} shadow-sm`}>
              {data.riskLevel} Risk
            </span>
          </div>
        </div>

        {/* 오른쪽: 상세 정보 영역 */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">

          {/* 헤더: 제목 및 닫기 버튼 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{data.type}</h2>
              <p className="text-slate-500 text-sm mt-1">ID: {data.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>

          {/* 본문 내용 */}
          <div className="space-y-6 flex-1">

            {/* 상세 설명 박스 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-slate-500" />
                상세 설명
              </h3>
              <p className="text-slate-700 text-sm leading-relaxed">{data.description}</p>
            </div>

            {/* 정보 그리드 (2열) */}
            <div className="grid grid-cols-2 gap-4">

              {/* 위치 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                  <MapPin className="w-3 h-3 mr-1" /> 위치
                </div>
                <div className="text-sm font-medium text-slate-800 break-words">{data.location}</div>
                <div className="text-xs text-slate-400 font-mono">{data.coordinates}</div>
              </div>

              {/* 발생 시간 */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                  <Calendar className="w-3 h-3 mr-1" /> 발생 시간
                </div>
                <div className="text-sm font-medium text-slate-800">{data.timestamp}</div>
              </div>

              {/* 상태 (수정된 부분 적용) */}
              <div className="space-y-1">
                <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
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
                <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                  <Server className="w-3 h-3 mr-1" /> 센서 데이터
                </div>
                <div className="text-xs font-mono text-slate-600 bg-slate-100 p-1.5 rounded border border-slate-200">
                  Gyro: {data.sensorData.gyro}<br />
                  Accel: {data.sensorData.accel}
                </div>
              </div>
            </div>

            {/* 신고자 정보 */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="flex items-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                <User className="w-3 h-3 mr-1" /> 신고자 / 감지기
              </div>
              <div className="text-sm font-medium text-slate-800">{data.reporter}</div>
            </div>

          </div>

          {/* 하단 버튼 영역 */}
          <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100">
            <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors">
              조치 보고서 작성
            </button>
            <button className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors">
              위치 지도 보기
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HazardModal;
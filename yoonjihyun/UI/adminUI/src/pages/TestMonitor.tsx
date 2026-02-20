import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. .env 파일에 등록한 API 키를 바탕으로 Supabase 클라이언트 생성 (DB 담당자 요청사항 완수)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Report {
  item_id: string;
  created_at: string;
  hazard_type: string;
  image_url: string;
  description: string;
  latitude: number;
  longitude: number;
  risk_level: number;
  distance: number;
  direction: string;
}

interface ReportCardProps {
  report: Report;
  baseUrl: string;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, baseUrl }) => {
  const fullImageUrl = `${baseUrl}/${report.image_url}`;

  const getRiskColor = (level: number) => {
    if (level >= 4) return 'bg-red-500';
    if (level >= 3) return 'bg-orange-500';
    return 'bg-amber-500';
  };

  const getDirectionLabel = (dir: string) => {
    if (dir === 'L') return '⬅️ 좌측';
    if (dir === 'R') return '➡️ 우측';
    return '⬆️ 정면';
  };

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="relative h-52 overflow-hidden bg-slate-100">
        <img
          src={fullImageUrl}
          alt="Detection"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x300?text=Image+Not+Found";
          }}
        />
        <div className={`absolute top-3 right-3 ${getRiskColor(report.risk_level)} text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-md uppercase`}>
          Lv.{report.risk_level} {report.hazard_type}
        </div>

        {/* 거리와 방향 배지 */}
        <div className="absolute top-3 left-3 bg-blue-800/90 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-md flex items-center gap-1.5 backdrop-blur-sm">
          <span>📏 {report.distance}m</span>
          <span className="w-px h-3 bg-blue-400/50"></span>
          <span>{getDirectionLabel(report.direction)}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">
            {new Date(report.created_at).toLocaleString()}
          </span>
        </div>

        <h3 className="text-slate-800 font-extrabold text-lg leading-tight mb-3 line-clamp-1">
          {report.description || "자동 감지 데이터"}
        </h3>

        <div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-sm">📍</span>
          <span className="text-xs font-medium font-mono">
            {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
          <span className="text-[9px] text-slate-300 font-mono truncate max-w-[150px]">
            ID: {report.item_id}
          </span>
          <button className="text-indigo-600 text-xs font-bold hover:underline">상세보기</button>
        </div>
      </div>
    </div>
  );
}

const TestMonitor: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // ngrok 환경을 포함할 수 있도록 동적 할당
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/`, {
        headers: {
          // 2. 외부 접속 테스트용 ngrok 우회 헤더 (DB 담당자 요청사항 완수)
          'ngrok-skip-browser-warning': 'true',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const sortedData = data.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setReports(sortedData);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    } catch (error) {
      console.error("서버 연결 오류:", error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    // 최초 1회 기존 데이터 가져오기
    fetchReports();

    // 3. Supabase Realtime 구독 (DB 담당자 요청: public.reports 테이블의 INSERT 감시)
    const channel = supabase
      .channel('realtime-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          console.log('🌟 새로운 데이터 실시간 수신 완료:', payload.new);
          const newReport = payload.new as Report;

          setReports((prevReports) => {
            const isDuplicate = prevReports.some(report => report.item_id === newReport.item_id);
            if (isDuplicate) return prevReports;
            return [newReport, ...prevReports];
          });

          setLastUpdated(new Date().toLocaleTimeString());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">📡 실시간 모니터링</h1>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            서버: <code className="bg-slate-200 px-2 py-0.5 rounded text-sm">{API_BASE_URL}</code>
            <span className="text-xs font-bold text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded ml-2">Supabase Realtime ON</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 uppercase font-semibold">Last Update</p>
            <p className="text-sm font-mono text-slate-700">{lastUpdated || "연결 중..."}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {loading && reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium">데이터 로드 중...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-2xl font-bold text-slate-300">수신된 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {reports.map((report, index) => (
              <ReportCard
                key={report.item_id || index}
                report={report}
                baseUrl={API_BASE_URL}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TestMonitor;
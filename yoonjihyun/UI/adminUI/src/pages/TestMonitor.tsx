import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Report {
  item_id: string;
  created_at: string;
  hazard_type: string;
  image_url: string;
  description: string;
  latitude: number | string;
  longitude: number | string;
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

  // ★ 빈화면 오류 방지: 확실하게 숫자로 변환 후 toFixed 적용
  const safeLat = Number(report.latitude || 0).toFixed(4);
  const safeLng = Number(report.longitude || 0).toFixed(4);

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
            {safeLat}, {safeLng}
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
  const [isSending, setIsSending] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/`, {
        headers: {
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

  // ★ 다른 컴퓨터에서도 작동하는 안전한 UUID 생성기
  const generateSafeUUID = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  };

  const sendDummyData = async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      const base64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      const res = await fetch(`data:image/gif;base64,${base64}`);
      const blob = await res.blob();

      const hazardTypes = ['점자블록 파손', '포트홀', '공사 자재 방치', '불법 주정차', '전동 킥보드 방치'];
      const randomHazard = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
      const directions = ['L', 'C', 'R'];
      const randomDir = directions[Math.floor(Math.random() * directions.length)];
      const randomRisk = Math.floor(Math.random() * 5) + 1;
      const randomDist = (Math.random() * 4.5 + 0.5).toFixed(2);

      const lat = (37.5665 + Math.random() * 0.01 - 0.005).toFixed(6);
      const lng = (126.9780 + Math.random() * 0.01 - 0.005).toFixed(6);

      const formData = new FormData();
      formData.append('item_id', generateSafeUUID());
      formData.append('user_id', generateSafeUUID());
      formData.append('latitude', lat);
      formData.append('longitude', lng);
      formData.append('hazard_type', randomHazard);
      formData.append('risk_level', randomRisk.toString());
      formData.append('distance', randomDist);
      formData.append('direction', randomDir);
      formData.append('description', `[테스트] ${randomHazard} 감지 (자동 생성)`);
      formData.append('file', blob, 'dummy.gif');

      const response = await fetch(`${API_BASE_URL}/api/v1/reports/`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("서버에서 오류를 반환했습니다.");
      }

    } catch (error) {
      alert("서버 연결 오류: 백엔드 서버가 켜져 있는지 확인해주세요.\n" + error);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    fetchReports();

    const channel = supabase
      .channel('realtime-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
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

          <button
            onClick={sendDummyData}
            disabled={isSending}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${isSending
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
              }`}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                전송 중...
              </>
            ) : (
              "📤 더미 데이터 추가"
            )}
          </button>
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
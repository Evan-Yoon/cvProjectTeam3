import React from 'react';
import { HazardData } from '../types';
import HazardTable from '../components/HazardTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface DashboardProps {
  data: HazardData[];
  onRowClick: (data: HazardData) => void;
  isDarkMode: boolean;
}

const StatCard = ({ title, value, subtext, icon, colorClass, isDarkMode }: any) => (
  <div className={`p-6 rounded-xl shadow-sm border flex items-start justify-between transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
    }`}>
    <div>
      <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
      <h3 className={`text-3xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{value}</h3>
      <p className={`text-xs mt-2 font-medium ${subtext.includes('+') ? (isDarkMode ? 'text-green-400' : 'text-green-600') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
        {subtext}
      </p>
    </div>
    <div className={`p-3 rounded-lg ${colorClass} transition-colors duration-300`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ data, onRowClick, isDarkMode }) => {
  const riskData = [
    { name: 'High', count: data.filter(h => h.riskLevel === 'High').length },
    { name: 'Medium', count: data.filter(h => h.riskLevel === 'Medium').length },
    { name: 'Low', count: data.filter(h => h.riskLevel === 'Low').length },
  ];

  const timeGroups = [0, 0, 0, 0, 0];
  data.forEach(h => {
    const dateObj = new Date(h.rawTimestamp || h.timestamp);
    if (isNaN(dateObj.getTime())) return;
    const hour = dateObj.getHours();
    if (hour >= 9 && hour < 11) timeGroups[0]++;
    else if (hour >= 11 && hour < 13) timeGroups[1]++;
    else if (hour >= 13 && hour < 15) timeGroups[2]++;
    else if (hour >= 15 && hour < 17) timeGroups[3]++;
    else if (hour >= 17) timeGroups[4]++;
  });

  const timeData = [
    { time: '09:00', reports: timeGroups[0] },
    { time: '11:00', reports: timeGroups[1] },
    { time: '13:00', reports: timeGroups[2] },
    { time: '15:00', reports: timeGroups[3] },
    { time: '17:00', reports: timeGroups[4] },
  ];

  const pendingCount = data.filter(h => h.status === 'Pending').length;
  const resolvedCount = data.filter(h => h.status === 'Resolved').length;
  const todayCount = data.filter(h => {
    const date = new Date(h.rawTimestamp || h.timestamp);
    return !isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>대시보드 개요</h2>
        <p className={`transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>실시간 안전 모니터링 현황입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="오늘 접수된 신고" value={todayCount} subtext="실시간 동기화 중"
          icon={<TrendingUp size={24} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />}
          colorClass={isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} isDarkMode={isDarkMode} />
        <StatCard title="처리 대기 중" value={pendingCount} subtext="긴급 조치 필요"
          icon={<AlertCircle size={24} className={isDarkMode ? 'text-red-400' : 'text-red-600'} />}
          colorClass={isDarkMode ? 'bg-red-900/30' : 'bg-red-50'} isDarkMode={isDarkMode} />
        <StatCard title="해결 완료" value={resolvedCount} subtext="실시간 업데이트"
          icon={<CheckCircle size={24} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />}
          colorClass={isDarkMode ? 'bg-green-900/30' : 'bg-green-50'} isDarkMode={isDarkMode} />
        <StatCard title="전체 누적 데이터" value={data.length} subtext="Total Reports"
          icon={<Clock size={24} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />}
          colorClass={isDarkMode ? 'bg-orange-900/30' : 'bg-orange-50'} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h3 className={`font-bold text-lg mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>위험 레벨 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke={isDarkMode ? '#475569' : '#cbd5e1'} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} stroke={isDarkMode ? '#475569' : '#cbd5e1'} />
                <Tooltip cursor={{ fill: isDarkMode ? '#1e293b' : '#f8fafc' }} contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', border: 'none', borderRadius: '8px', color: isDarkMode ? '#f1f5f9' : '#0f172a' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h3 className={`font-bold text-lg mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>시간대별 접수 횟수</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke={isDarkMode ? '#475569' : '#cbd5e1'} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} stroke={isDarkMode ? '#475569' : '#cbd5e1'} />
                <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', border: 'none', borderRadius: '8px', color: isDarkMode ? '#f1f5f9' : '#0f172a' }} />
                <Line type="monotone" dataKey="reports" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className={`font-bold text-lg mb-4 transition-colors duration-300 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>최근 접수 내역 (Live Feed)</h3>
        {/* ★ 여기에 isDarkMode를 넘겨줍니다 */}
        <HazardTable data={data.slice(0, 5)} onRowClick={onRowClick} compact isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};

export default Dashboard;
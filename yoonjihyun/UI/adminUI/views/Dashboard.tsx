import React from 'react';
import { HazardData } from '../types';
import HazardTable from '../components/HazardTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface DashboardProps {
  data: HazardData[]; // ★ 추가: 실제 데이터를 부모로부터 받습니다.
  onRowClick: (data: HazardData) => void;
}

const StatCard = ({ title, value, subtext, icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      <p className={`text-xs mt-2 font-medium ${subtext.includes('+') ? 'text-green-600' : 'text-slate-400'}`}>
        {subtext}
      </p>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ data, onRowClick }) => {
  // 실제 데이터를 바탕으로 위험 레벨 계산
  const riskData = [
    { name: 'High', count: data.filter(h => h.riskLevel === 'High').length },
    { name: 'Medium', count: data.filter(h => h.riskLevel === 'Medium').length },
    { name: 'Low', count: data.filter(h => h.riskLevel === 'Low').length },
  ];

  // 실제 데이터의 시간대를 분석하여 차트 데이터 생성
  const timeGroups = [0, 0, 0, 0, 0];
  data.forEach(h => {
    const hour = new Date(h.timestamp).getHours();
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
  // 오늘 접수된 건수 계산
  const todayCount = data.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">대시보드 개요</h2>
        <p className="text-slate-500">실시간 안전 모니터링 현황입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="오늘 접수된 신고"
          value={todayCount}
          subtext="실시간 동기화 중"
          icon={<TrendingUp size={24} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="처리 대기 중"
          value={pendingCount}
          subtext="긴급 조치 필요"
          icon={<AlertCircle size={24} className="text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          title="해결 완료"
          value={resolvedCount}
          subtext="실시간 업데이트"
          icon={<CheckCircle size={24} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="전체 누적 데이터"
          value={data.length}
          subtext="Total Reports"
          icon={<Clock size={24} className="text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4">위험 레벨 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4">시간대별 신고 추이</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="reports" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-4">최근 접수 내역 (Live Feed)</h3>
        {/* 최근 5개만 잘라서 보여줍니다. */}
        <HazardTable data={data.slice(0, 5)} onRowClick={onRowClick} compact />
      </div>
    </div>
  );
};

export default Dashboard;
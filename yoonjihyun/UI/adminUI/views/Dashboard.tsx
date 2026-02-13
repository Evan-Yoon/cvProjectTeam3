import React from 'react';
import { MOCK_HAZARDS } from '../constants';
import { HazardData } from '../types';
import HazardTable from '../components/HazardTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface DashboardProps {
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

const Dashboard: React.FC<DashboardProps> = ({ onRowClick }) => {
  // Simple aggregation for charts
  const riskData = [
    { name: 'High', count: MOCK_HAZARDS.filter(h => h.riskLevel === 'High').length },
    { name: 'Medium', count: MOCK_HAZARDS.filter(h => h.riskLevel === 'Medium').length },
    { name: 'Low', count: MOCK_HAZARDS.filter(h => h.riskLevel === 'Low').length },
  ];

  const timeData = [
    { time: '09:00', reports: 2 },
    { time: '11:00', reports: 5 },
    { time: '13:00', reports: 8 },
    { time: '15:00', reports: 3 },
    { time: '17:00', reports: 6 },
  ];

  const pendingCount = MOCK_HAZARDS.filter(h => h.status === 'Pending').length;
  const resolvedCount = MOCK_HAZARDS.filter(h => h.status === 'Resolved').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">대시보드 개요</h2>
        <p className="text-slate-500">실시간 안전 모니터링 현황입니다.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="오늘 접수된 신고" 
          value={MOCK_HAZARDS.length} 
          subtext="+12% since yesterday" 
          icon={<TrendingUp size={24} className="text-blue-600"/>} 
          color="bg-blue-50"
        />
        <StatCard 
          title="처리 대기 중" 
          value={pendingCount} 
          subtext="긴급 조치 필요" 
          icon={<AlertCircle size={24} className="text-red-600"/>} 
          color="bg-red-50"
        />
        <StatCard 
          title="해결 완료" 
          value={resolvedCount} 
          subtext="이번 주 완료율 94%" 
          icon={<CheckCircle size={24} className="text-green-600"/>} 
          color="bg-green-50"
        />
        <StatCard 
          title="평균 처리 시간" 
          value="4.2h" 
          subtext="-0.5h 개선됨" 
          icon={<Clock size={24} className="text-orange-600"/>} 
          color="bg-orange-50"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-4">위험 레벨 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
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
                <XAxis dataKey="time" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="reports" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Feed */}
      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-4">최근 접수 내역 (Live Feed)</h3>
        <HazardTable data={MOCK_HAZARDS.slice(0, 5)} onRowClick={onRowClick} compact />
      </div>
    </div>
  );
};

export default Dashboard;
import React from 'react';
import { Save, Bell, Shield, Key, User } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">시스템 설정 (Settings)</h2>
        <p className="text-slate-500">사용자 프로필 및 시스템 임계값 관리</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <User className="text-slate-500" />
            <h3 className="font-bold text-slate-800">사용자 프로필 관리</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
              <input type="text" defaultValue="김관리" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
              <input type="email" defaultValue="admin@walkmate.com" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:outline-none" />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">직책</label>
              <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white">
                <option>최고 관리자 (Admin)</option>
                <option>매니저</option>
                <option>뷰어</option>
              </select>
            </div>
            <button className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium mt-2 hover:bg-slate-900 transition-colors">
                비밀번호 변경
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Bell className="text-slate-500" />
            <h3 className="font-bold text-slate-800">알림 설정 (Notifications)</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium text-slate-800">High-Risk (3단계) 알림</div>
                    <div className="text-xs text-slate-500">즉각적인 위험 발생 시 푸시 알림</div>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full bg-green-500 cursor-pointer">
                    <span className="absolute left-6 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all"></span>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium text-slate-800">일일 리포트</div>
                    <div className="text-xs text-slate-500">매일 오전 9시 요약본 이메일 발송</div>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full bg-slate-200 cursor-pointer">
                    <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all"></span>
                </div>
            </div>
             <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium text-slate-800">시스템 상태 업데이트</div>
                    <div className="text-xs text-slate-500">서버 점검 및 연결 상태 알림</div>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full bg-green-500 cursor-pointer">
                    <span className="absolute left-6 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all"></span>
                </div>
            </div>
          </div>
        </div>

        {/* API Config */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Key className="text-slate-500" />
            <h3 className="font-bold text-slate-800">API 연결 상태 (Connection Status)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-semibold text-green-700">B2B Server: Connected</span>
                </div>
                <label className="block text-xs font-medium text-slate-500 mb-1">B2B API Key</label>
                <input type="password" value="sk_live_XXXXXXXXXXXXXXXXXXXX" readOnly className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-semibold text-green-700">B2G Server: Connected</span>
                </div>
                <label className="block text-xs font-medium text-slate-500 mb-1">B2G API Secret</label>
                <input type="password" value="sk_gov_XXXXXXXXXXXXXXXXXXXX" readOnly className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
             </div>
          </div>
          <button className="mt-4 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
            연결 테스트 (Test Connection)
          </button>
        </div>

         {/* Thresholds */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Shield className="text-slate-500" />
            <h3 className="font-bold text-slate-800">시스템 임계값 설정 (Threshold Settings)</h3>
          </div>
          
          <div className="space-y-6">
             <div className="flex items-center gap-4">
                 <div className="w-16 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-700">75</div>
                 <div className="flex-1">
                     <div className="flex justify-between mb-1">
                         <span className="text-sm font-medium text-slate-800">AI 위험 판단 민감도 (0-100)</span>
                         <span className="text-xs text-slate-500">High Sensitivity</span>
                     </div>
                     <input type="range" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" defaultValue={75} />
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <div className="w-16 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-700">3</div>
                 <div className="flex-1">
                     <div className="flex justify-between mb-1">
                         <span className="text-sm font-medium text-slate-800">위험 등급 기준 레벨 (1-5)</span>
                         <span className="text-xs text-slate-500">Medium</span>
                     </div>
                     <input type="range" min="1" max="5" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" defaultValue={3} />
                 </div>
             </div>
          </div>
        </div>

      </div>
      
      <div className="flex justify-end pt-4">
        <button className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-3 px-8 rounded-lg shadow-lg shadow-yellow-500/30 transition-all">
            <Save size={20} />
            모든 설정 저장
        </button>
      </div>
    </div>
  );
};

export default Settings;
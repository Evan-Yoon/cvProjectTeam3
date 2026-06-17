import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import HazardTable from "../../components/HazardTable";
import HazardModal from "../../components/HazardModal";
import { HazardData, RiskLevel, Status } from "../../types"; // 필요시 경로 수정

// 환경 변수 설정
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://172.30.1.80:8000";

export default function ReportsPage() {
    const [reports, setReports] = useState<HazardData[]>([]);
    const [selectedHazard, setSelectedHazard] = useState<HazardData | null>(null);

    // 1. DB 데이터를 UI 규격(HazardData)으로 변환하는 함수
    const mapToHazardData = (dbReport: any): HazardData => {
        // 위험도 숫자를 문자로 변환
        let riskLabel: RiskLevel = 'Low';
        if (dbReport.risk_level >= 4) riskLabel = 'High';
        else if (dbReport.risk_level === 3) riskLabel = 'Medium';

        // DB에 status 컬럼이 없다면 임시로 'Pending' 처리
        const currentStatus: Status = dbReport.status || 'Pending';

        // 방향 코드를 한글로 변환
        const dirMap: Record<string, string> = { 'L': '좌측', 'R': '우측', 'C': '정면' };
        const directionStr = dirMap[dbReport.direction] || '정면';

        return {
            id: dbReport.item_id,
            type: dbReport.hazard_type,
            riskLevel: riskLabel,
            timestamp: new Date(dbReport.created_at).toLocaleString(),
            // 좌표 대신 직관적인 거리/방향 데이터 조합
            location: `위도: ${dbReport.latitude.toFixed(4)}, 경도: ${dbReport.longitude.toFixed(4)}`,
            coordinates: `거리: ${dbReport.distance}m | 방향: ${directionStr}`,
            status: currentStatus,
            reportType: 'B2G',
            thumbnail: `${API_BASE_URL}/${dbReport.image_url}`,
            description: dbReport.description || "자동 감지 시스템에 의해 수집된 데이터입니다.",
            address: "주소 정보 없음", // 필요시 실제 데이터 매핑
            reporter: "WalkMate AI Camera",
        };
    };

    // 2. 초기 데이터 로딩 (FastAPI 또는 Supabase 활용)
    const fetchInitialData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData = data.map(mapToHazardData);
                setReports(formattedData);
            }
        } catch (err) {
            console.error("데이터 로드 실패:", err);
        }
    }, []);

    // 3. Supabase Realtime 구독 (실시간 화면 갱신)
    useEffect(() => {
        fetchInitialData();

        const channel = supabase
            .channel('reports_page_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reports' },
                (payload) => {
                    const newHazard = mapToHazardData(payload.new);
                    setReports((prev) => {
                        if (prev.some(r => r.id === newHazard.id)) return prev;
                        return [newHazard, ...prev];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchInitialData]);

    // 4. 대시보드 상단 통계 위젯 계산
    const todayCount = reports.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length;
    const pendingCount = reports.filter(r => r.status === 'Pending').length;
    const resolvedCount = reports.filter(r => r.status === 'Resolved').length;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* --- 대시보드 위젯 영역 --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                    <p className="text-sm font-semibold text-slate-500 mb-2">오늘 접수된 신고</p>
                    <p className="text-4xl font-bold text-slate-800">{todayCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                    <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center justify-between">
                        처리 대기 중 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    </p>
                    <p className="text-4xl font-bold text-red-600">{pendingCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                    <p className="text-sm font-semibold text-slate-500 mb-2 flex items-center justify-between">
                        해결 완료 <span className="text-green-500">✔</span>
                    </p>
                    <p className="text-4xl font-bold text-green-600">{resolvedCount}</p>
                </div>
            </div>

            {/* --- 데이터 테이블 영역 --- */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-4">최근 접수 내역 (Live Feed)</h2>
                <HazardTable
                    data={reports}
                    onRowClick={(hazard) => setSelectedHazard(hazard)}
                />
            </div>

            {/* --- 상세 정보 모달 --- */}
            {selectedHazard && (
                <HazardModal
                    data={selectedHazard}
                    onClose={() => setSelectedHazard(null)}
                />
            )}
        </div>
    );
}
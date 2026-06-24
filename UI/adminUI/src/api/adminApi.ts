// .env에서 가져온 주소 끝에 혹시 모를 공백이나 슬래시를 제거하는 안전장치
// VITE_BACKEND_URL은 FastAPI 서버 주소입니다. 설정이 없으면 개발용 IP를 fallback으로 사용합니다.
const RAW_URL = import.meta.env.VITE_BACKEND_URL ?? "http://172.30.1.80:8000";
// API_BASE 뒤에 /가 있으면 아래 URL 조합에서 //가 생길 수 있어 마지막 슬래시 하나를 제거합니다.
const API_BASE = RAW_URL.replace(/\/$/, "");

export type ReportRow = {
    // backend/app/crud/report.py의 admin list SELECT 결과와 맞춘 타입입니다.
    item_id: string;
    hazard_type: string;
    image_url: string;
    created_at: string;
    status: "new" | "processing" | "done" | "hidden";
    risk_level: number;
    latitude?: number;
    longitude?: number;
    description?: string | null;
    device_id?: string;
};

export const fetchReports = async (skip = 0, limit = 100) => {
    // ★ 핵심 수정: URL을 미리 만들어서 슬래시가 절대 붙지 않게 확인
    // FastAPI admin router는 /api/v1/reports 경로에 skip/limit 쿼리를 받습니다.
    const url = `${API_BASE}/api/v1/reports?skip=${skip}&limit=${limit}`;

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "ngrok-skip-browser-warning": "true",
            "Content-Type": "application/json",
        },
    });

    // fetch는 HTTP 4xx/5xx에서도 throw하지 않으므로 ok를 직접 확인합니다.
    if (!res.ok) throw new Error(`fetchReports failed: ${res.status}`);
    return await res.json() as { total: number; data: ReportRow[] };
};

export const patchReportStatus = async (itemId: string, status: "new" | "processing" | "done" | "hidden") => {
    // 상태 변경은 PATCH /api/v1/reports/{item_id}?status=... 형태입니다.
    const url = `${API_BASE}/api/v1/reports/${itemId}?status=${status}`;

    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "ngrok-skip-browser-warning": "true",
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) throw new Error(`patchReportStatus failed: ${res.status}`);
    return await res.json();
};

export const deleteReport = async (itemId: string) => {
    // 실제 DB 삭제가 아니라 백엔드에서 status='Hidden'으로 바꾸는 소프트 삭제입니다.
    const url = `${API_BASE}/api/v1/reports/${itemId}`;

    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            "ngrok-skip-browser-warning": "true",
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) throw new Error(`deleteReport failed: ${res.status}`);
    return await res.json();
};

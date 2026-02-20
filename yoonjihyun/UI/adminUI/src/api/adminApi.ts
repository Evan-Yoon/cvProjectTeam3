// .env에서 가져온 주소 끝에 혹시 모를 공백이나 슬래시를 제거하는 안전장치
const RAW_URL = import.meta.env.VITE_BACKEND_URL ?? "http://172.30.1.80:8000";
const API_BASE = RAW_URL.replace(/\/$/, "");

export type ReportRow = {
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
    const url = `${API_BASE}/api/v1/reports?skip=${skip}&limit=${limit}`;

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "ngrok-skip-browser-warning": "true",
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) throw new Error(`fetchReports failed: ${res.status}`);
    return await res.json() as { total: number; data: ReportRow[] };
};

export const patchReportStatus = async (itemId: string, status: "new" | "processing" | "done" | "hidden") => {
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
    // Soft delete: Change status to 'hidden'
    return patchReportStatus(itemId, "hidden");
};
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type ReportRow = {
    item_id: string;
    hazard_type: string;
    image_url: string;
    created_at: string;
    status: "new" | "processing" | "done";
    risk_level: number;
    latitude?: number;
    longitude?: number;
    description?: string | null;
    device_id?: string;
};

export const fetchReports = async (skip = 0, limit = 100) => {
    const res = await fetch(`${API_BASE}/api/v1/reports/?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error(`fetchReports failed: ${res.status}`);
    const result = await res.json();

  // result: { total, data: ReportRow[] }
    return result as { total: number; data: ReportRow[] };
};

export const patchReportStatus = async (itemId: string, status: "new" | "processing" | "done") => {
    const res = await fetch(`${API_BASE}/api/v1/reports/${itemId}?status=${status}`, {
        method: "PATCH",
    });
    if (!res.ok) throw new Error(`patchReportStatus failed: ${res.status}`);
    return await res.json();
};
import { useEffect, useState } from "react";
import { fetchReports, patchReportStatus, ReportRow } from "../api/adminApi";

export default function ReportsPage() {
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
    (async () => {
        const result = await fetchReports(0, 100);
        setRows(result.data);
        setTotal(result.total);
    })().catch(console.error);
    }, []);

    const onMarkDone = async (itemId: string) => {
    // 간단 optimistic update
    setRows((prev) => prev.map(r => r.item_id === itemId ? { ...r, status: "done" } : r));
    try {
        await patchReportStatus(itemId, "done");
    } catch (e) {
      // 실패 시 롤백
        setRows((prev) => prev.map(r => r.item_id === itemId ? { ...r, status: "processing" } : r));
        throw e;
        }
    };

    return (
    <div>
        <h1>Reports ({total})</h1>
        <ul>
            {rows.map(r => (
            <li key={r.item_id}>
                {r.hazard_type} / {r.status} / {r.created_at}
                <button onClick={() => onMarkDone(r.item_id)}>Done</button>
            </li>
            ))}
        </ul>
        </div>
    );
}

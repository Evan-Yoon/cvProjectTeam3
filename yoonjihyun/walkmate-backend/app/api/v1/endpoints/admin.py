from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.crud.report import count_reports, list_reports_admin, patch_status

router = APIRouter(prefix="/reports", tags=["admin"])

@router.get("/", summary="📋 관리자 전체 목록 조회 (Admin)")
def get_reports_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    total = count_reports(db)
    data = list_reports_admin(db, skip=skip, limit=limit)
    return {"total": total, "data": data}


@router.patch("/{item_id}", summary="✅ 처리 상태 변경 (Admin)")
def patch_report_status(
    item_id: UUID,
    status: str = Query(..., description="new|processing|done"),
    db: Session = Depends(get_db),
):
    if status not in ("new", "processing", "done"):
        raise HTTPException(status_code=400, detail="status must be one of new, processing, done")

    row = patch_status(db, item_id=item_id, status=status)
    if not row:
        raise HTTPException(status_code=404, detail="report not found")

    return {"success": True, "data": row}

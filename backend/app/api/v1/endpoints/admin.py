from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.crud.report import count_reports, list_reports_admin, patch_status, delete_report

# admin.py는 관리자 대시보드가 사용하는 신고 목록/상태 변경/삭제 API를 정의합니다.
# main.py에서 prefix="/api/v1"로 붙기 때문에 실제 경로는 /api/v1/reports/... 입니다.
router = APIRouter(prefix="/reports", tags=["admin"])

@router.get("/", summary="📋 관리자 전체 목록 조회 (Admin)")
def get_reports_admin(
    # skip/limit은 페이지네이션용 쿼리 파라미터입니다. Query의 ge/le가 최소/최대값을 검증합니다.
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """관리자 화면의 테이블 목록과 총 개수를 반환합니다."""
    total = count_reports(db)
    data = list_reports_admin(db, skip=skip, limit=limit)
    return {"total": total, "data": data}


@router.patch("/{item_id}", summary="✅ 처리 상태 변경 (Admin)")
def patch_report_status(
    item_id: UUID,
    status: str = Query(..., description="new|processing|done"),
    db: Session = Depends(get_db),
):
    """신고 처리 상태를 new/processing/done 중 하나로 변경합니다."""
    # 프론트에서 임의 문자열을 보내도 DB 상태값이 오염되지 않게 허용 목록을 검사합니다.
    if status not in ("new", "processing", "done"):
        raise HTTPException(status_code=400, detail="status must be one of new, processing, done")

    row = patch_status(db, item_id=item_id, status=status)
    if not row:
        raise HTTPException(status_code=404, detail="report not found")

    return {"success": True, "data": row}

@router.delete("/{item_id}", summary="🗑️ 항목 삭제 (Admin - 숨김 처리)")
def soft_delete_report(
    item_id: UUID,
    db: Session = Depends(get_db),
):
    """실제 DB row를 삭제하지 않고 status='Hidden'으로 바꾸는 소프트 삭제입니다."""
    try:
        deleted_row = delete_report(db=db, item_id=item_id)
        if not deleted_row:
             raise HTTPException(status_code=404, detail="Report not found")
        return {
             "success": True,
             "message": f"Report {item_id} deleted successfully",
             "data": deleted_row
        }
    except Exception as e:
        print(f"❌ Delete Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

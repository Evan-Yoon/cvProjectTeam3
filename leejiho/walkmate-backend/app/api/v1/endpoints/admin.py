from fastapi import APIRouter, HTTPException, Query
from typing import List

# 주방장(CRUD)과 메뉴판(Schemas)을 가져옵니다.
from app.crud import report as crud_report
from app.models import schemas

# ✅ 여기가 핵심입니다! main.py가 찾고 있던 'router' 변수입니다.
router = APIRouter()

# 1. 지도용 경량 데이터 조회
# URL: GET /api/v1/admin/map
@router.get("/map")
def get_map_data():
    """
    [관리자] 지도에 표시할 경량 데이터를 가져옵니다.
    """
    return crud_report.get_reports_for_map()

# 2. 전체 리스트 조회 (페이지네이션 포함)
# URL: GET /api/v1/admin/reports
@router.get("/reports", response_model=List[schemas.ReportResponse])
def get_admin_reports(
    skip: int = 0, 
    limit: int = Query(100, le=100) # 최대 100개 제한
):
    """
    [관리자] 신고 내역 전체를 조회합니다.
    """
    return crud_report.get_all_reports(skip=skip, limit=limit)

# 3. 신고 상태 변경
# URL: PATCH /api/v1/admin/reports/{report_id}
@router.patch("/reports/{report_id}", response_model=schemas.ReportResponse)
def update_report_status(report_id: int, status_in: schemas.ReportUpdate):
    """
    [관리자] 특정 신고의 처리 상태를 변경합니다.
    """
    updated_report = crud_report.update_report_status(report_id, status_in.status)
    
    if not updated_report:
        raise HTTPException(status_code=404, detail="해당 신고를 찾을 수 없습니다.")
        
    return updated_report
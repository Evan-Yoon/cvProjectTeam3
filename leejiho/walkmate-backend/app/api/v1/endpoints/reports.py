from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from app.crud import report as crud_report
from app.services.s3_uploader import s3_uploader

router = APIRouter()

# =================================================================
# 1. [앱] 위험물 신고 접수 (통합 파이프라인: S3 -> DB)
# =================================================================
@router.post("/")
async def create_report_pipeline(
    item_id: str = Form(...),
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    hazard_type: str = Form(...),
    risk_level: int = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...)
):
    try:
        # 1. S3 업로드
        s3_url = await s3_uploader.upload_image(file)
        if not s3_url:
            raise HTTPException(status_code=500, detail="S3 Upload Failed")

        # 2. 데이터 병합
        report_data = {
            "item_id": item_id,
            "user_id": user_id,
            "latitude": latitude,
            "longitude": longitude,
            "hazard_type": hazard_type,
            "risk_level": risk_level,
            "description": description,
            "image_url": s3_url
        }

        # 3. DB 저장
        new_report = crud_report.create_report(report_data)
        
        return {
            "success": True, 
            "item_id": new_report['item_id'], 
            "image_url": s3_url,
            "message": "Report created successfully."
        }

    except Exception as e:
        print(f"Pipeline Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =================================================================
# 2. [관리자] 지도 마커 데이터 조회 (가벼운 정보만)
# =================================================================
@router.get("/map")
def read_reports_for_map():
    """
    지도에 뿌릴 마커 데이터(위치, 상태, 타입)만 조회합니다.
    """
    try:
        results = crud_report.get_reports_for_map()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =================================================================
# 3. [관리자] 전체 신고 목록 조회 (페이지네이션)
# =================================================================
# app/api/v1/endpoints/reports.py
@router.get("/")
def read_all_reports(
    skip: int = Query(0, description="..."),
    limit: int = Query(20, description="...")
): # <--- 여기에 response_model=List[...] 가 있다면 삭제하세요!
    try:
        results = crud_report.get_all_reports(skip=skip, limit=limit)
        return results # 이제 딕셔너리 {total:..., data:...} 가 나갑니다.
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =================================================================
# 4. [관리자] 신고 상태 변경 (예: new -> done)
# =================================================================
@router.patch("/{item_id}")
def update_report_status(item_id: str, status: str):
    """
    특정 신고 건의 처리 상태를 변경합니다.
    """
    try:
        # status 값 유효성 검사 (DB Check 제약조건과 별개로 API단에서도 방어)
        if status not in ["new", "processing", "done"]:
            raise HTTPException(status_code=400, detail="Invalid status value")

        updated_item = crud_report.update_report_status(item_id, status)
        
        if not updated_item:
            raise HTTPException(status_code=404, detail="Item not found")

        return {"success": True, "data": updated_item}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
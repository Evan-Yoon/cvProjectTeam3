from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from app.crud import report as crud_report
from app.services.s3_uploader import s3_uploader
from fastapi import APIRouter
from app.services.tmap_service import get_navigation_path
from pydantic import BaseModel

router = APIRouter()

import logging
logger = logging.getLogger("API_LOGGER")

from app.models.schemas import HeatmapResponse

# 1. [앱] 위험물 신고 접수 (통합 파이프라인: S3 -> DB)
@router.post("/")
async def create_report_pipeline(
    item_id: str = Form(...),
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    distance: float = Form(...),
    direction: str = Form(...),
    hazard_type: str = Form(...),
    risk_level: int = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...)
):
    if direction not in ['L', 'C', 'R']:
        raise HTTPException(status_code=400, detail="Direction must be L, C, or R")

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
        "distance": distance,
        "direction": direction,
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

# [추가] 히트맵 전용 라우터 (Bounding Box 좌표값을 Query Parameter로 받음)
@router.get("/heatmap", response_model=List[HeatmapResponse])
def read_heatmap_data(
    min_lat: float = Query(..., description="지도 남단의 위도"),
    max_lat: float = Query(..., description="지도 북단의 위도"),
    min_lng: float = Query(..., description="지도 서단의 경도"),
    max_lng: float = Query(..., description="지도 동단의 경도")
):
    """
    현재 클라이언트 지도 화면(Bounding Box) 영역 안의 데이터만 필터링하여 
    히트맵 시각화에 필요한 최소한의 데이터만 반환합니다.
    """
    results = crud_report.get_heatmap_data(
        min_lat=min_lat, max_lat=max_lat, min_lng=min_lng, max_lng=max_lng
    )
    return results


# 2. [관리자] 지도 마커 데이터 조회
@router.get("/map")
def read_reports_for_map():
    """
    지도에 뿌릴 마커 데이터(위치, 상태, 타입)만 조회합니다.
    """

    results = crud_report.get_reports_for_map()
    return results


# 3. [관리자] 전체 신고 목록 조회 (페이지네이션)
# app/api/v1/endpoints/reports.py
@router.get("/")
def read_all_reports(
    skip: int = Query(0, description="..."),
    limit: int = Query(20, description="...")
): 
    results = crud_report.get_all_reports(skip=skip, limit=limit)
    return results


# 4. [관리자] 신고 상태 변경 (예: new -> done)
@router.patch("/{item_id}")
def update_report_status(item_id: str, status: str):
    """
    특정 신고 건의 처리 상태를 변경합니다.
    """

    # status 값 유효성 검사 
    if status not in ["new", "processing", "done"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    updated_item = crud_report.update_report_status(item_id, status)
    
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"success": True, "data": updated_item}
    

class RouteRequestModel(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

# 2. 선생님이 기존에 붙여넣으셨던 코드 (수정 불필요)
# 표준 예문: reports.py 맨 아래 함수 수정
@router.post("/path")
async def create_navigation_path(req_data: RouteRequestModel):
    navigation_steps = await get_navigation_path(
        start_coord={"x": req_data.start_lon, "y": req_data.start_lat},
        end_coord={"x": req_data.end_lon, "y": req_data.end_lat}
    )
    # 가공된 딕셔너리 배열을 프론트엔드에 최종 반환
    return {"status": "success", "data": navigation_steps}
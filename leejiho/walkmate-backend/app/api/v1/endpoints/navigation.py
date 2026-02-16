# 라우터 파일 맨 위에 있어야 하는 필수 모듈
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.tmap_service import get_navigation_path

# (아까 말씀드린 Pydantic 설계도도 이 라우터 함수 바로 위에 있어야 합니다)
class RouteRequestModel(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

router = APIRouter()

# 2. API 창구 개설 (POST 메서드)
@router.post("/path")
async def create_navigation_path(req_data: RouteRequestModel):
    # FE가 보낸 객체를 딕셔너리로 변환하여 Tmap 서비스 공장에 전달
    navigation_steps = await get_navigation_path(
        start_coord={"x": req_data.start_lon, "y": req_data.start_lat},
        end_coord={"x": req_data.end_lon, "y": req_data.end_lat}
    )
    # 가공된 딕셔너리 배열을 최종 반환
    return {"status": "success", "data": navigation_steps}
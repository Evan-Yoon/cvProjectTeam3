from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal

# 1. [공통] 모든 모델의 base
class ReportBase(BaseModel):
    device_id: str
    hazard_type: str
    latitude: float  
    longitude: float
    image_url: str
    distance: float
    direction: Literal['L', 'C', 'R']
    description: Optional[str] = None # 선택 항목 (없으면 null)
    risk_level: int = 1

# 2. [입력] 앱에서 신고할 때 사용하는 양식 (Request)
class ReportCreate(ReportBase):
    pass 
    # Base와 똑같으므로 내용 없음(pass). 

# 3. [출력] DB에서 꺼내서 보여줄 때 사용하는 양식 (Response)
class ReportResponse(ReportBase):
    id: int
    created_at: datetime
    status: str 

    # Pydantic 설정 (ORM 모드 호환성)
    class Config:
        from_attributes = True

# 4. [수정] 관리자가 상태를 변경할 때 사용하는 양식 (Update)
class ReportUpdate(BaseModel):
    status: Literal['new', 'processing', 'done']

# [추가] 히트맵 전용 초경량 응답 모델 (불필요한 데이터 제거)
class HeatmapResponse(BaseModel):
    lat: float
    lng: float
    distance: float
    direction: Literal['L', 'C', 'R']
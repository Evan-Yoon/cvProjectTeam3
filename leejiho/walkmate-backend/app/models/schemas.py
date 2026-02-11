from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal

# 1. [공통] 모든 모델의 뼈대 (Base)
class ReportBase(BaseModel):
    device_id: str
    hazard_type: str
    latitude: float  # 실수형 (Double)
    longitude: float
    image_url: str
    description: Optional[str] = None # 선택 항목 (없으면 null)
    risk_level: int = 1               # 기본값 1

# 2. [입력] 앱에서 신고할 때 사용하는 양식 (Request)
class ReportCreate(ReportBase):
    pass 
    # Base와 똑같으므로 내용 없음(pass). 
    # 만약 '약관 동의 여부' 같이 DB엔 안 들어가지만 필요한 게 있다면 여기에 추가.

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
    # status는 'new', 'processing', 'done' 중 하나여야 함을 강제 (유효성 검사)
    status: Literal['new', 'processing', 'done']
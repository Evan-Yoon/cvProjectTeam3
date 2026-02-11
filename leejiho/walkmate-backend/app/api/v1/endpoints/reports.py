from fastapi import APIRouter, HTTPException
from app.crud import report as crud_report
from app.models import schemas # ✅ 메뉴판(스키마) 추가!

router = APIRouter()

# 1. response_model 추가: 응답도 예쁘게 포장해서 줍니다.
@router.post("/", response_model=schemas.ReportResponse) 
def create_report(report_in: schemas.ReportCreate): # ✅ 입력도 엄격하게 검사합니다.
    """
    [앱] 새로운 위험물을 신고합니다.
    """
    # 2. Pydantic 모델을 딕셔너리로 변환 (DB는 딕셔너리를 좋아하니까요)
    report_data = report_in.model_dump()
    
    # 3. 주방장에게 전달 (이건 똑같습니다!)
    try:
        new_report = crud_report.create_report(report_data)
        return new_report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
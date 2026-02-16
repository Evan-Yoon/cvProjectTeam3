from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import uuid4, UUID
import shutil
import os
from datetime import datetime

from app.core.database import get_db
from app.crud import report as crud_report

router = APIRouter()

# 이미지 저장할 디렉토리 설정 (main.py 설정과 맞춰야 함)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def create_report(
    item_id: str = Form(...),
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    hazard_type: str = Form(...),
    risk_level: int = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),  # 앱에서 보낸 이미지 파일
    db: Session = Depends(get_db)
):
    try:
        # 1. 고유한 파일명 생성 (중복 방지)
        # 예: 20240216_123456_uuid.jpg
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 파일 확장자 추출 (없으면 기본 jpg)
        file_extension = "jpg"
        if file.filename and "." in file.filename:
            file_extension = file.filename.split(".")[-1]

        saved_filename = f"{timestamp}_{uuid4().hex[:8]}.{file_extension}"

        file_path = os.path.join(UPLOAD_DIR, saved_filename)

        # 2. 서버 로컬 폴더(uploads)에 이미지 저장
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 3. DB에 저장할 URL 생성
        # main.py에서 '/static'을 'uploads' 폴더로 연결했으므로,
        # 브라우저 접근 URL은 http://서버IP:8000/static/파일명 이 됩니다.
        image_url = f"static/{saved_filename}"

        # 4. DB에 정보 저장 (CRUD 호출)
        # item_id와 user_id는 앱에서 문자로 오므로 UUID로 변환
        report = crud_report.create_report(
            db=db,
            item_id=UUID(item_id),
            user_id=UUID(user_id),
            latitude=latitude,
            longitude=longitude,
            hazard_type=hazard_type,
            risk_level=risk_level,
            image_url=image_url,  # 생성한 URL 전달
            description=description
        )

        return {
            "status": "success",
            "message": "Report created successfully",
            "data": report
        }

    except Exception as e:
        print(f"❌ Upload Failed: {str(e)}")
        # 에러 내용을 더 자세히 보기 위해 출력
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
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

        # 2. 이미지 저장 (S3 필수)
        from app.core.config import S3_BUCKET_NAME
        from app.services.s3_uploader import upload_image_to_s3

        if not S3_BUCKET_NAME:
             raise HTTPException(status_code=500, detail="Server Configuration Error: S3_BUCKET_NAME is missing. Local storage is disabled.")

        try:
            # 파일 포인터를 처음으로 되돌림 (필요 시)
            await file.seek(0)
            content = await file.read()
            
            # S3 업로드
            s3_key = f"uploads/{saved_filename}"
            full_s3_url = upload_image_to_s3(content, s3_key, file.content_type)
            image_url = full_s3_url
            print(f"✅ S3 Upload Success: {image_url}")

        except Exception as s3_error:
            print(f"❌ S3 Upload Failed: {s3_error}")
            raise HTTPException(status_code=500, detail=f"S3 Upload Failed: {str(s3_error)}")

        # 3. DB에 정보 저장 (CRUD 호출)
        report = crud_report.create_report(
            db=db,
            item_id=UUID(item_id),
            user_id=UUID(user_id),
            latitude=latitude,
            longitude=longitude,
            hazard_type=hazard_type,
            risk_level=risk_level,
            image_url=image_url,
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
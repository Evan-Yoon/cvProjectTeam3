from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import uuid4, UUID
from datetime import datetime

from app.core.database import get_db
from app.crud import report as crud_report

router = APIRouter()

@router.post("/")
async def create_report(
    # VisionCamera/report.ts가 FormData로 보내는 필드명과 여기의 Form(...) 이름이 정확히 맞아야 합니다.
    item_id: str = Form(...),
    user_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    hazard_type: str = Form(...),
    risk_level: int = Form(...),
    description: str = Form(None),
    label: str = Form(...),
    file: UploadFile = File(...),  # 앱에서 보낸 이미지 파일
    db: Session = Depends(get_db)
):
    """사용자 앱이 감지한 위험 요소 신고를 이미지와 함께 받아 S3와 DB에 저장합니다."""
    try:
        # 1. 고유한 파일명 생성 (중복 방지)
        # 예: 20240216_123456_uuid.jpg
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 파일 확장자 추출 (없으면 기본 jpg)
        # 클라이언트가 report_image.jpg처럼 보낸 파일명에서 확장자만 재사용합니다.
        file_extension = "jpg"
        if file.filename and "." in file.filename:
            file_extension = file.filename.split(".")[-1]

        # 같은 시간에 여러 신고가 들어와도 uuid 일부를 붙여 S3 key 충돌을 줄입니다.
        saved_filename = f"{timestamp}_{uuid4().hex[:8]}.{file_extension}"

        # 2. 이미지 저장 (S3 필수)
        # 함수 내부 import는 기존 구조를 유지합니다. 실제 업로드 로직은 services/s3_uploader.py에 있습니다.
        from app.core.config import S3_BUCKET_NAME
        from app.services.s3_uploader import upload_image_to_s3

        if not S3_BUCKET_NAME:
             raise HTTPException(status_code=500, detail="Server Configuration Error: S3_BUCKET_NAME is missing.")

        try:
            # 파일 포인터를 처음으로 되돌림 (필요 시)
            await file.seek(0)
            # UploadFile은 비동기 파일 객체라 await read()로 bytes를 꺼냅니다.
            content = await file.read()
            
            # S3 업로드
            # uploads/ prefix를 붙여 버킷 안에서 신고 이미지들을 한 폴더처럼 묶습니다.
            s3_key = f"uploads/{saved_filename}"
            full_s3_url = upload_image_to_s3(content, s3_key, file.content_type)
            image_url = full_s3_url
            print(f"✅ S3 Upload Success: {image_url}")

        except Exception as s3_error:
            print(f"❌ S3 Upload Failed: {s3_error}")
            raise HTTPException(status_code=500, detail=f"S3 Upload Failed: {str(s3_error)}")

        # 3. DB에 정보 저장 (CRUD 호출)
        # item_id/user_id는 문자열로 들어오지만 DB 로직은 UUID 타입을 기대하므로 여기서 변환합니다.
        report = crud_report.create_report(
            db=db,
            item_id=UUID(item_id),
            user_id=UUID(user_id),
            latitude=latitude,
            longitude=longitude,
            hazard_type=hazard_type,
            risk_level=risk_level,
            image_url=image_url,
            description=description,
            label=label
        )

        return {
            "status": "success",
            "message": "Report created successfully",
            # SQLAlchemy RowMapping은 FastAPI가 JSON 변환 가능한 형태로 직렬화합니다.
            "data": report
        }

    except Exception as e:
        print(f"❌ Upload Failed: {str(e)}")
        # 에러 내용을 더 자세히 보기 위해 출력
        import traceback
        traceback.print_exc()
        # 현재는 모든 예외를 500으로 감싸므로, 운영 단계에서는 UUID 오류/검증 오류를 400으로 나누면 더 좋습니다.
        raise HTTPException(status_code=500, detail=str(e))

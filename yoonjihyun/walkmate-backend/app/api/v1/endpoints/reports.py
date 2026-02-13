from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.services.s3_uploader import upload_image_to_s3
from app.crud.report import create_report, get_map_markers

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("/", summary="📸 위험물 신고 접수 (App)")
async def post_report(
    item_id: UUID = Form(...),
    user_id: UUID = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    hazard_type: str = Form(...),
    risk_level: int = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    if not (1 <= risk_level <= 5):
        raise HTTPException(status_code=400, detail="risk_level must be 1~5")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if len(file_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="image too large (max 8MB)")

    key = f"reports/{item_id}.jpg"
    image_url = upload_image_to_s3(file_bytes, key=key, content_type=file.content_type)

    create_report(
        db,
        item_id=item_id,
        user_id=user_id,
        latitude=latitude,
        longitude=longitude,
        hazard_type=hazard_type,
        risk_level=risk_level,
        image_url=image_url,
        description=description,
    )

    return {
        "success": True,
        "item_id": str(item_id),
        "image_url": image_url,
        "message": "Report created successfully."
    }


@router.get("/map", summary="🗺️ 지도 마커 조회 (App/Web)")
def get_map(db: Session = Depends(get_db)):
    rows = get_map_markers(db)
    # 명세대로 배열 그대로 반환
    return list(rows)

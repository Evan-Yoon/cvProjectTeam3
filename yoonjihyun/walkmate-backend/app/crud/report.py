from sqlalchemy import text
from sqlalchemy.orm import Session
from uuid import UUID

def create_report(
    db: Session,
    *,
    item_id: UUID,
    user_id: UUID,         # API user_id (UUID)
    latitude: float,
    longitude: float,
    hazard_type: str,
    risk_level: int,
    image_url: str,
    description: str | None
):
    q = text("""
        insert into public.reports
            (item_id, location, device_id, hazard_type, risk_level, image_url, description)
            values
            (
            :item_id,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
            :device_id,
            :hazard_type,
            :risk_level,
            :image_url,
            :description
            )
        returning
            item_id,
            hazard_type,
            risk_level,
            image_url,
            status,
            created_at
    """)
    row = db.execute(q, {
        "item_id": str(item_id),
        "device_id": str(user_id),  # ✅ DB device_id에 user_id(UUID 문자열) 저장
        "latitude": latitude,
        "longitude": longitude,
        "hazard_type": hazard_type,
        "risk_level": risk_level,
        "image_url": image_url,
        "description": description,
    }).mappings().first()
    db.commit()
    return row


def get_map_markers(db: Session):
    q = text("""
        select
            item_id,
            ST_Y(location) as latitude,
            ST_X(location) as longitude,
            hazard_type,
            risk_level,
            status
        from public.reports
        order by created_at desc
    """)
    return db.execute(q).mappings().all()


def count_reports(db: Session) -> int:
    q = text("select count(*) as cnt from public.reports")
    return int(db.execute(q).mappings().first()["cnt"])


def list_reports_admin(db: Session, skip: int, limit: int):
    q = text("""
        select
            item_id,
            hazard_type,
            image_url,
            description,
            status,
            created_at,
            risk_level,
            device_id,
            ST_Y(location) as latitude,
            ST_X(location) as longitude
        from public.reports
        order by created_at desc
        offset :skip
        limit :limit
    """)
    return db.execute(q, {"skip": skip, "limit": limit}).mappings().all()


def patch_status(db: Session, item_id: UUID, status: str):
    q = text("""
        update public.reports
        set status = :status
        where item_id = :item_id
        returning item_id, status
    """)
    row = db.execute(q, {"item_id": str(item_id), "status": status}).mappings().first()
    db.commit()
    return row

from sqlalchemy import text
from sqlalchemy.orm import Session
from uuid import UUID

# ------------------------------------------------------------------
# 1. 신고 생성 (Create)
# ------------------------------------------------------------------
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
    # SQL 쿼리 작성 (PostGIS 함수 사용)
    q = text("""
        INSERT INTO public.reports
            (item_id, location, device_id, hazard_type, risk_level, image_url, description)
        VALUES
            (
                :item_id,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
                :device_id,
                :hazard_type,
                :risk_level,
                :image_url,
                :description
            )
        RETURNING
            item_id,
            hazard_type,
            risk_level,
            image_url,
            status,
            created_at
    """)

    # 파라미터 바인딩 및 실행
    params = {
        "item_id": str(item_id),
        "device_id": str(user_id),  # DB 컬럼명 device_id에 user_id 저장
        "latitude": latitude,
        "longitude": longitude,
        "hazard_type": hazard_type,
        "risk_level": risk_level,
        "image_url": image_url,
        "description": description or "" # None이면 빈 문자열로 처리
    }

    try:
        # execute() 실행 후 .mappings().first()로 결과 가져오기
        result = db.execute(q, params)
        row = result.mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        print(f"❌ DB Insert Error: {e}")
        raise e


# ------------------------------------------------------------------
# 2. 지도 마커 조회 (Read - Map)
# ------------------------------------------------------------------
def get_map_markers(db: Session):
    q = text("""
        SELECT
            item_id,
            ST_Y(location) as latitude,
            ST_X(location) as longitude,
            hazard_type,
            risk_level,
            status
        FROM public.reports
        WHERE status != 'Hidden'
        ORDER BY created_at DESC
    """)
    return db.execute(q).mappings().all()


# ------------------------------------------------------------------
# 3. 전체 신고 개수 조회 (Read - Count)
# ------------------------------------------------------------------
def count_reports(db: Session) -> int:
    q = text("SELECT count(*) as cnt FROM public.reports WHERE status != 'Hidden'")
    result = db.execute(q).mappings().first()
    return int(result["cnt"]) if result else 0


# ------------------------------------------------------------------
# 4. 관리자용 목록 조회 (Read - Admin List)
# ★ 실시간 모니터링 페이지에서 사용하는 함수입니다.
# ------------------------------------------------------------------
def list_reports_admin(db: Session, skip: int, limit: int):
    q = text("""
        SELECT
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
        FROM public.reports
        WHERE status != 'Hidden'
        ORDER BY created_at DESC
        OFFSET :skip
        LIMIT :limit
    """)

    params = {"skip": skip, "limit": limit}
    return db.execute(q, params).mappings().all()


# ------------------------------------------------------------------
# 5. 상태 변경 (Update - Patch)
# ------------------------------------------------------------------
def patch_status(db: Session, item_id: UUID, status: str):
    q = text("""
        UPDATE public.reports
        SET status = :status
        WHERE item_id = :item_id
        RETURNING item_id, status
    """)

    params = {"item_id": str(item_id), "status": status}

    try:
        row = db.execute(q, params).mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        print(f"❌ DB Update Error: {e}")
        raise e

# ------------------------------------------------------------------
# 6. 신고 삭제 (Delete)
# ------------------------------------------------------------------
def delete_report(db: Session, item_id: UUID):
    q = text("""
        UPDATE public.reports
        SET status = 'Hidden'
        WHERE item_id = :item_id
        RETURNING item_id
    """)

    params = {"item_id": str(item_id)}

    try:
        row = db.execute(q, params).mappings().first()
        db.commit()
        return row
    except Exception as e:
        db.rollback()
        print(f"❌ DB Delete Error: {e}")
        raise e
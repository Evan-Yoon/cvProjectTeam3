from sqlalchemy import text
from sqlalchemy.orm import Session
from uuid import UUID

# crud/report.py는 SQL을 직접 실행하는 데이터 접근 계층입니다.
# API 엔드포인트는 HTTP/FormData 처리만 하고, 실제 reports 테이블 조작은 이 파일에 모읍니다.

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
    description: str | None,
    label: str
):
    # SQL 쿼리 작성 (PostGIS 함수 사용)
    # ST_MakePoint는 경도, 위도 순서로 받습니다. SRID 4326은 WGS84 GPS 좌표계를 뜻합니다.
    q = text("""
        INSERT INTO public.reports
            (item_id, location, device_id, hazard_type, risk_level, image_url, description, label)
        VALUES
            (
                :item_id,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
                :device_id,
                :hazard_type,
                :risk_level,
                :image_url,
                :description,
                :label
            )
        RETURNING
            item_id,
            hazard_type,
            risk_level,
            image_url,
            status,
            created_at,
            label
    """)

    # 파라미터 바인딩 및 실행
    # text() + params 바인딩을 쓰면 문자열 포맷팅보다 SQL injection 위험을 줄일 수 있습니다.
    params = {
        "item_id": str(item_id),
        "device_id": str(user_id),  # DB 컬럼명 device_id에 user_id 저장
        "latitude": latitude,
        "longitude": longitude,
        "hazard_type": hazard_type,
        "risk_level": risk_level,
        "image_url": image_url,
        "description": description or "", # None이면 빈 문자열로 처리
        "label": label
    }

    try:
        # execute() 실행 후 .mappings().first()로 결과 가져오기
        # mappings()는 row를 dict처럼 접근 가능한 형태로 돌려줍니다.
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
    """지도 마커용 좌표/위험도 데이터를 최신순으로 조회합니다."""
    q = text("""
        SELECT
            item_id,
            -- PostGIS point에서 위도/경도를 다시 숫자 컬럼으로 꺼냅니다.
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
    """관리자 목록 페이지네이션을 위한 전체 신고 수를 조회합니다."""
    q = text("SELECT count(*) as cnt FROM public.reports WHERE status != 'Hidden'")
    result = db.execute(q).mappings().first()
    return int(result["cnt"]) if result else 0


# ------------------------------------------------------------------
# 4. 관리자용 목록 조회 (Read - Admin List)
# ★ 실시간 모니터링 페이지에서 사용하는 함수입니다.
# ------------------------------------------------------------------
def list_reports_admin(db: Session, skip: int, limit: int):
    """관리자 테이블에 표시할 신고 목록을 skip/limit 페이지네이션으로 가져옵니다."""
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
    # skip/limit도 바인딩 파라미터로 넘겨 SQL 문자열을 직접 조합하지 않습니다.
    return db.execute(q, params).mappings().all()


# ------------------------------------------------------------------
# 5. 상태 변경 (Update - Patch)
# ------------------------------------------------------------------
def patch_status(db: Session, item_id: UUID, status: str):
    """특정 신고의 처리 상태만 변경하고 변경된 item_id/status를 반환합니다."""
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
    """신고를 물리 삭제하지 않고 Hidden 상태로 숨깁니다."""
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

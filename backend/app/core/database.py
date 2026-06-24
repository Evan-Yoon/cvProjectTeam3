from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

# database.py는 SQLAlchemy 연결 엔진과 요청별 DB 세션 생성기를 정의합니다.
# API 엔드포인트는 Depends(get_db)로 세션을 주입받아 쿼리를 실행합니다.

if not DATABASE_URL:
    # DB 주소가 없으면 서버가 떠도 신고 저장/관리자 조회가 모두 실패하므로 시작 시점에 명확히 중단합니다.
    raise RuntimeError("DATABASE_URL is missing")

# pool_pre_ping=True는 오래된 연결을 쓰기 전에 살아 있는지 확인해 Supabase/Postgres idle 연결 문제를 줄입니다.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
# autocommit=False라서 create/update/delete 함수가 직접 commit/rollback을 관리합니다.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency: 요청 하나마다 DB 세션을 만들고, 응답 후 반드시 닫습니다."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

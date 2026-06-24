from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.admin import router as admin_router

# main.py는 FastAPI 서버의 진입점입니다.
# uvicorn app.main:app 형태로 실행하면 아래 app 객체를 찾아 HTTP 서버가 시작됩니다.
app = FastAPI(title="WalkMate (SafeStep) API")

# CORS는 브라우저 프론트엔드가 다른 주소의 백엔드 API를 호출할 수 있게 허용하는 설정입니다.
# 개발 중에는 localhost/Vite 주소가 다를 수 있으므로 config.py의 CORS_ORIGINS를 읽어 적용합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    """서버가 살아 있는지 빠르게 확인하는 헬스체크 엔드포인트입니다."""
    return {"ok": True}

# 신고 생성 API: /api/v1/reports/
app.include_router(reports_router, prefix="/api/v1/reports")
# 관리자 API: /api/v1/reports/... 형태로 목록/상태 변경/삭제를 제공합니다.
app.include_router(admin_router, prefix="/api/v1")

# ★ [추가] 네비게이션 라우터 등록
# import를 아래에 둔 이유는 기존 코드 구조를 유지하기 위해서입니다. 결과적으로 /api/v1/navigation/path가 등록됩니다.
from app.api.v1.endpoints.navigation import router as navigation_router
app.include_router(navigation_router, prefix="/api/v1")

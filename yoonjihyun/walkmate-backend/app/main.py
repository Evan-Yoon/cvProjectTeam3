from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles # ★ [추가 1] 이미지 서빙용 라이브러리
from fastapi.middleware.cors import CORSMiddleware
import os # ★ [추가 2] 폴더 생성용

from app.core.config import CORS_ORIGINS
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.admin import router as admin_router

app = FastAPI(title="WalkMate (SafeStep) API")

# ★ [추가 3] 'uploads' 폴더가 없으면 만들고, '/static' 주소로 연결하기
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

app.include_router(reports_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")

# ★ [추가] 네비게이션 라우터 등록
from app.api.v1.endpoints.navigation import router as navigation_router
app.include_router(navigation_router, prefix="/api/v1")
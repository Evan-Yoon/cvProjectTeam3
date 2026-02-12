from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import reports # ✅ 우리가 수정한 파일 import

app = FastAPI(title="WalkMate API")

# 1. CORS 설정 (안드로이드 앱 통신 필수)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 모든 곳에서 접속 허용 (개발 단계용)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 라우터 연결 (이게 있어야 API가 작동합니다!)
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 1. 우리가 만든 [주방]과 [메뉴판]을 가져옵니다.
from app.api.v1.endpoints import reports, admin 

# 2. 기존에 만드신 S3 업로드 기능도 가져옵니다. (테스트용 유지)
from app.services.s3_uploader import s3_uploader 

app = FastAPI(title="WalkMate Backend", version="1.0.0")

# ---------------------------------------------------------
# [1] 보안 설정 (CORS) - 앱/웹 연동 필수
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # 모든 곳에서 접속 허용 (개발용)
    allow_credentials=True,
    allow_methods=["*"],      # 모든 HTTP 메서드 허용 (GET, POST 등)
    allow_headers=["*"],      # 모든 헤더 허용
)

# ---------------------------------------------------------
# [2] 라우터 등록 (전선 연결) - 이게 핵심입니다!
# ---------------------------------------------------------

# (1) 앱용 신고 API 연결 (/api/v1/reports)
app.include_router(
    reports.router, 
    prefix="/api/v1/reports", 
    tags=["Reports (App)"]
)

# (2) 관리자용 API 연결 (/api/v1/admin)
app.include_router(
    admin.router, 
    prefix="/api/v1/admin", 
    tags=["Admin"]
)

# ---------------------------------------------------------
# [3] 기본 및 테스트 엔드포인트 (기존 코드 유지)
# ---------------------------------------------------------

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}

# 📸 [기존 코드 유지] 이미지 업로드 단독 테스트용
# 나중에 reports API가 잘 작동하면 이 부분은 지우셔도 됩니다.
@app.post("/api/v1/test-upload", tags=["Test"])
async def upload_test(file: UploadFile = File(...)):
    url = s3_uploader.upload_image(file)
    return {
        "success": True,
        "image_url": url,
        "filename": file.filename
    }

# ---------------------------------------------------------
# [4] 서버 실행 (python main.py로 실행 시)
# ---------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
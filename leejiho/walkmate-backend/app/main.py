from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import reports
from fastapi import APIRouter
from app.api.v1.endpoints import navigation # 1. 방금 만든 파일을 불러옴

# 로그 세분화용
import time
import logging
from fastapi import Request

app = FastAPI(title="WalkMate API")

# 1. CORS 설정 (안드로이드 앱 통신 필수)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 모든 곳에서 접속 허용 (개발 단계용) -> 추후 수정 필요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 라우터 연결
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}

api_router = APIRouter()
api_router.include_router(navigation.router, prefix="/navigation", tags=["Navigation"])


# 로그 출력 형식 세팅
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger("API_LOGGER")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # 1. 입구: 어떤 주소로 어떤 메서드가 들어왔는지 기록
    logger.info(f"➡️ [요청 시작] {request.method} {request.url.path}")

    # 2. 본문(라우터) 실행
    response = await call_next(request)

    # 3. 출구: 걸린 시간과 결과 코드 기록
    process_time = (time.time() - start_time) * 1000
    logger.info(f"⬅️ [요청 완료] {response.status_code} | 소요시간: {process_time:.2f}ms")

    return response
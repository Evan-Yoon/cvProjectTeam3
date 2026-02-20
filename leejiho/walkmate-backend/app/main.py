from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.endpoints import reports, navigation
import time
from app.core.logger import setup_logger

# 로그 출력 형식 세팅
logger = setup_logger()

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

# 3. 네비게이션 라우터 연결 
app.include_router(navigation.router, prefix="/api/v1/navigation", tags=["Navigation"])

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # 1. HTTP Exception (우리가 의도적으로 발생시킨 에러) 처리
    if isinstance(exc, HTTPException):
        # 500번대 에러는 서버 문제이므로 로그를 남김
        if exc.status_code >= 500:
            logger.error(f"❌ [HTTP Exception] {exc.detail}")
        else:
            # 400번대 에러는 클라이언트 과실이므로 경고만 남김
            logger.warning(f"⚠️ [HTTP Exception] {exc.detail}")
            
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # 2. 예기치 못한 에러 (Traceback 포함)
    logger.error(f"❌ [Global Exception] {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}, # 개발 단계에서만 에러 내용 노출
    )

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # 1. 입구: 어떤 주소로 어떤 메서드가 들어왔는지 기록 (IP 포함)
    user_agent = request.headers.get("user-agent", "unknown")
    logger.info(f"➡️ [요청 시작] {request.method} {request.url.path} | Device: {user_agent}")

    try:
        # 2. 본문(라우터) 실행
        response = await call_next(request)

        # 3. 출구: 걸린 시간과 결과 코드 기록
        process_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"⬅️ [요청 완료] {response.status_code} | 소요시간: {process_time:.2f}ms"
        )
        
        return response
    except Exception as e:
        # 미들웨어에서 놓친 에러가 있다면 여기서도 잡힐 수 있음
        raise e
from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.endpoints import reports, navigation
import time
import time
import uuid
from app.core.logger import setup_logger, request_id_context

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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # 에러 로그 기록 (Traceback 포함)
    logger.error(f"❌ [Global Exception] {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}, # 개발 단계에서만 에러 내용 노출
    )

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}


# 3. 네비게이션 라우터 연결 (기존에 연결 안 되어 있었음)
app.include_router(navigation.router, prefix="/api/v1/navigation", tags=["Navigation"])

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    # ContextVar에 request_id 설정 (이후 로그에서 자동으로 사용됨)
    token = request_id_context.set(request_id)

    start_time = time.time()
    
    # 1. 입구: 어떤 주소로 어떤 메서드가 들어왔는지 기록 (IP 포함)
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"➡️ [START] {request.method} {request.url.path} | IP: {client_host}")

    try:
        # 2. 본문(라우터) 실행
        response = await call_next(request)

        # 3. 출구: 걸린 시간과 결과 코드 기록
        process_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"⬅️ [END] {response.status_code} | {process_time:.2f}ms"
        )
        
        # 응답 헤더에 Request ID 포함 (클라이언트 디버깅용)
        response.headers["X-Request-ID"] = request_id
        
        return response
    finally:
        # 요청 처리 완료 후 ContextVar 정리 (메모리 누수 방지)
        request_id_context.reset(token)
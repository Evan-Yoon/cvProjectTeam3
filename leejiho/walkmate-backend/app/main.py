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

import os
from fastapi.responses import PlainTextResponse, HTMLResponse

@app.get("/")
def read_root():
    return {"message": "WalkMate Server is Running! 🚀"}

@app.get("/logs", description="최근 백엔드 서버 로그 100줄을 확인합니다.")
def view_logs():
    # 로그 파일이 저장되는 경로
    log_path = "logs/app.log"
    if not os.path.exists(log_path):
        return PlainTextResponse("No logs found.", status_code=404)
    
    try:
        # 마지막 100줄만 읽기
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            tail_lines = lines[-100:] 
            
        return PlainTextResponse("".join(tail_lines))
    except Exception as e:
        return PlainTextResponse(f"Error reading logs: {str(e)}", status_code=500)

@app.get("/mirror", description="임시: DB에 적재되는 x,y,w,h 실시간 미러링 페이지")
def view_mirror():
    html_content = """
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>Real-time DB Mirror (x,y,w,h)</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f9f9f9; }
            h1 { color: #333; }
            .status { margin-bottom: 20px; color: #666; font-size: 0.9em; }
            table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #eee; padding: 12px 15px; text-align: center; }
            th { background-color: #007bff; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            tr:hover { background-color: #f1f8ff; }
            img { max-height: 80px; border-radius: 4px; }
            .badge { padding: 4px 8px; border-radius: 12px; font-size: 0.85em; font-weight: bold; }
            .new { background: #e3f2fd; color: #0d47a1; }
        </style>
    </head>
    <body>
        <h1>🕒 Real-time Bounding Box Mirror</h1>
        <div class="status">
            <button onclick="fetchData()" style="padding: 5px 15px; cursor: pointer; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; margin-right: 10px; font-weight: bold;">🔄 데이터 수동 갱신</button>
            마지막 업데이트: <span id="last-updated" style="font-weight: bold; color: #d32f2f;"></span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>항목 ID</th>
                    <th>생성 시각</th>
                    <th>분류</th>
                    <th>x</th>
                    <th>y</th>
                    <th>w</th>
                    <th>h</th>
                    <th>거리/방향</th>
                    <th>이미지</th>
                </tr>
            </thead>
            <tbody id="data-table">
                <tr><td colspan="9" style="text-align:center; padding: 20px;">데이터를 불러오는 중...</td></tr>
            </tbody>
        </table>

        <script>
            async function fetchData() {
                try {
                    const response = await fetch('/api/v1/reports/?limit=20');
                    if (!response.ok) throw new Error("API Network error");
                    const result = await response.json();
                    
                    const tbody = document.getElementById('data-table');
                    tbody.innerHTML = '';
                    
                    if (result.data && result.data.length > 0) {
                        result.data.forEach(item => {
                            const tr = document.createElement('tr');
                            
                            // Parse date
                            let timeStr = '-';
                            if (item.created_at) {
                                const d = new Date(item.created_at);
                                timeStr = d.toLocaleTimeString('ko-KR', { hour12: false });
                            }
                            
                            tr.innerHTML = `
                                <td><span class="badge new">${item.item_id || item.id || '-'}</span></td>
                                <td>${timeStr}</td>
                                <td style="font-weight: bold;">${item.hazard_type || '-'}</td>
                                <td>${item.x !== undefined && item.x !== null ? Number(item.x).toFixed(4) : '-'}</td>
                                <td>${item.y !== undefined && item.y !== null ? Number(item.y).toFixed(4) : '-'}</td>
                                <td>${item.w !== undefined && item.w !== null ? Number(item.w).toFixed(4) : '-'}</td>
                                <td>${item.h !== undefined && item.h !== null ? Number(item.h).toFixed(4) : '-'}</td>
                                <td>${item.distance ? item.distance.toFixed(1) + 'm' : '-'} (${item.direction || '-'})</td>
                                <td>${item.image_url ? '<a href="'+item.image_url+'" target="_blank"><img src="'+item.image_url+'" alt="image"/></a>' : '<span style="color:#aaa;">No Image</span>'}</td>
                            `;
                            tbody.appendChild(tr);
                        });
                    } else {
                        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">현재 접수된 데이터가 없습니다.</td></tr>';
                    }
                    
                    const now = new Date();
                    document.getElementById('last-updated').innerText = now.toLocaleTimeString('ko-KR') + '.' + now.getMilliseconds().toString().padStart(3, '0');
                } catch (error) {
                    console.error("Error fetching data:", error);
                    document.getElementById('last-updated').innerText = "업데이트 실패 (재시도 중...)";
                }
            }

            // Initialize data on page load
            fetchData();
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

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
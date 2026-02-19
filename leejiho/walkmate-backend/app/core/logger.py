import logging
import os
import contextvars
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime

# Request ID를 저장할 ContextVar (기본값: "SYSTEM")
request_id_context = contextvars.ContextVar("request_id", default="SYSTEM")

class RequestIdFilter(logging.Filter):
    """
    로그 레코드에 request_id를 주입하는 필터
    """
    def filter(self, record):
        record.request_id = request_id_context.get()
        return True

def setup_logger():
    # 1. 로그 저장할 폴더 생성
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # 2. 로거 생성
    logger = logging.getLogger("API_LOGGER")
    logger.setLevel(logging.INFO)

    # 핸들러가 이미 있다면 중복 추가 방지
    if logger.handlers:
        return logger

    # 3. 포맷 설정 (Request ID 포함)
    formatter = logging.Formatter(
        "[%(asctime)s] [%(request_id)s] %(levelname)s\n%(message)s"
    )

    # 필터 인스턴스 생성
    request_id_filter = RequestIdFilter()

    # 4. 핸들러 1: 콘솔 출력
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(request_id_filter) # 필터 추가
    logger.addHandler(stream_handler)

    # 5. 핸들러 2: 파일 저장 (날짜별 회전)
    filename = os.path.join(log_dir, "app.log") 
    
    file_handler = TimedRotatingFileHandler(
        filename=filename,
        when="midnight",  # 자정마다 회전
        interval=1,       # 1일 간격
        encoding="utf-8", # 한글 깨짐 방지
        backupCount=30    # 30일치 보관 (오래된 로그 자동 삭제)
    )
    file_handler.suffix = "%Y-%m-%d" # 파일명 뒤에 날짜 붙임
    file_handler.setFormatter(formatter)
    file_handler.addFilter(request_id_filter) # 필터 추가
    logger.addHandler(file_handler)

    return logger

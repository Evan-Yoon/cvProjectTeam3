import logging
import os
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime

# ANSI 색상 코드
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
BLUE = "\033[34m"
CYAN = "\033[36m"

class CustomColorFormatter(logging.Formatter):
    """
    로그 레벨과 메시지 내용에 따라 색상을 입히는 포매터
    """
    def format(self, record):
        # 1. 기본 로그 포맷
        log_fmt = "%(asctime)s - %(levelname)s - %(message)s"
        
        # 2. 레벨별 색상 적용 (기본)
        if record.levelno == logging.DEBUG:
            prefix_color = BLUE
        elif record.levelno == logging.INFO:
            prefix_color = GREEN
        elif record.levelno == logging.WARNING:
            prefix_color = YELLOW
        elif record.levelno == logging.ERROR:
            prefix_color = RED
        elif record.levelno == logging.CRITICAL:
            prefix_color = RED + BOLD
        else:
            prefix_color = RESET

        # 3. 메시지 내용 기반 하이라이팅 (요청/응답/에러)
        msg = record.getMessage()
        if "200 " in msg or "201 " in msg: # 성공
            msg_color = GREEN
        elif "404 " in msg or "400 " in msg: # 클라이언트 에러
            msg_color = YELLOW
        elif "500 " in msg: # 서버 에러
            msg_color = RED
        elif "➡️" in msg: # 요청 시작
            msg_color = CYAN
        else:
            msg_color = RESET

        # 4. 최종 포맷 조립
        # [시간 - 레벨] 부분은 prefix_color
        # [메시지] 부분은 msg_color
        formatter = logging.Formatter(
            f"{prefix_color}%(asctime)s - %(levelname)s{RESET} - {msg_color}%(message)s{RESET}"
        )
        return formatter.format(record)

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

    # 3. 포맷 설정 (파일용: 색상 없음)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s"
    )

    # 4. 핸들러 1: 콘솔 출력 (색상 적용)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(CustomColorFormatter())
    logger.addHandler(stream_handler)

    # 5. 핸들러 2: 파일 저장 (날짜별 회전 - 색상 없음)
    filename = os.path.join(log_dir, "app.log") 
    
    file_handler = TimedRotatingFileHandler(
        filename=filename,
        when="midnight",  # 자정마다 회전
        interval=1,       # 1일 간격
        encoding="utf-8", # 한글 깨짐 방지
        backupCount=30    # 30일치 보관 (오래된 로그 자동 삭제)
    )
    file_handler.suffix = "%Y-%m-%d" # 파일명 뒤에 날짜 붙임
    file_handler.setFormatter(file_formatter)
    
    logger.addHandler(file_handler)

    # Uvicorn의 기본 액세스 로그(INFO 레벨) 거슬리면 끄기
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    return logger

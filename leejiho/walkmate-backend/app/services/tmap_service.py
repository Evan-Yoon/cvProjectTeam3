import os
import httpx
from dotenv import load_dotenv

# 통신 함수가 시작되기 전에, 파일 맨 위쪽에서 무조건 먼저 실행되어야 합니다!
load_dotenv()
import logging
from fastapi import HTTPException

logger = logging.getLogger("API_LOGGER")

# 1. [통신 담당] 순수하게 Tmap 서버에서 원본 JSON 트리만 가져옴
async def fetch_tmap_data(start_coord, end_coord):
    async with httpx.AsyncClient() as client:
        req_data = {
            "startX": start_coord["x"], "startY": start_coord["y"], # y좌표도 필요합니다!
            "endX": end_coord["x"], "endY": end_coord["y"],
            "startName": "출발지", # Tmap 필수 파라미터
            "endName": "목적지"    # Tmap 필수 파라미터
        }
        
        # 1. 진짜 Tmap 보행자 경로 탐색 URL
        real_url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"
        
        # 2. 선생님의 신분증(App Key)을 헤더에 동봉
        # 2. 하드코딩 대신 메모리(os.getenv)에서 안전하게 키를 꺼내옴
        secret_key = os.getenv("TMAP_API_KEY")
        
        headers = {
            "appKey": secret_key, 
            "Accept": "application/json"
        }
        
        try:
            # 3. 요청 전송
            response = await client.post(real_url, json=req_data, headers=headers)
            response.raise_for_status() # 4xx, 5xx 에러 발생 시 예외 송출
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"TMAP API Error: {e.response.text}")
            raise HTTPException(status_code=502, detail="TMAP External Gateway Error")
        except httpx.RequestError as e:
            logger.error(f"TMAP Connection Error: {e}")
            raise HTTPException(status_code=503, detail="TMAP Service Unavailable")

# [표준 예문] app/services/tmap_service.py 내부 파싱 로직 수정
async def get_navigation_path(start_coord, end_coord):
    raw_tree = await fetch_tmap_data(start_coord, end_coord)
    
    refined_path = []
    for node in raw_tree.get("features", []):
        # 방향 전환점(Point) 노드만 필터링
        if node.get("geometry", {}).get("type") == "Point":
            coords = node.get("geometry", {}).get("coordinates") 
            
            step_info = {
                "instruction": node.get("properties", {}).get("description"), # 예: "우회전 후 17m 이동"
                "latitude": coords[1],  # Y좌표 (위도)
                "longitude": coords[0]  # X좌표 (경도)
            }
            refined_path.append(step_info)
            
    return refined_path
from fastapi import APIRouter
from pydantic import BaseModel
import requests
import json
from app.core.config import TMAP_API_KEY

router = APIRouter()

# TMAP API Key
# 서버 환경변수에서 읽은 키를 모듈 상수로 보관합니다.
TMAP_APP_KEY = TMAP_API_KEY

class NavigationRequest(BaseModel):
    """프론트 App.tsx가 보내는 출발지/목적지 좌표 요청 형식입니다."""
    # TMAP은 X=경도(lon), Y=위도(lat)를 사용하므로 프론트와 이름을 명확히 맞춥니다.
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

@router.post("/navigation/path")
async def get_walking_path(req: NavigationRequest):
    """TMAP 보행자 경로 API를 호출하고, 프론트가 쓰기 쉬운 steps/path 구조로 변환합니다."""
    url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"

    headers = {
        "appKey": TMAP_APP_KEY,
        "Content-Type": "application/json"
    }

    data = {
        # TMAP 요청 바디는 경도를 X, 위도를 Y로 받습니다.
        "startX": req.start_lon,
        "startY": req.start_lat,
        "endX": req.end_lon,
        "endY": req.end_lat,
        "reqCoordType": "WGS84GEO",
        "resCoordType": "WGS84GEO",
        "startName": "Start",
        "endName": "End"
    }

    try:
        # requests.post는 동기 호출입니다. 현재 함수는 async지만 여기서는 짧은 외부 API 호출을 그대로 사용합니다.
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code != 200:
            print(f"TMAP Error: {response.text}")
            return {"status": "error", "message": "TMAP API Error"}

        result = response.json()
        features = result.get("features", [])
        
        steps = []
        path_coords = [] # ★ [추가] 경로 좌표 리스트 (배열의 배열)

        for feature in features:
            # TMAP 응답은 GeoJSON Feature 배열이며, Point는 안내 지점, LineString은 실제 경로 선입니다.
            geometry = feature.get("geometry", {})
            properties = feature.get("properties", {})
            
            if geometry.get("type") == "Point":
                # TMAP 좌표 순서는 [lon, lat]이므로 프론트에서 쓰는 latitude/longitude로 바꿉니다.
                lat = geometry["coordinates"][1]
                lon = geometry["coordinates"][0]
                desc = properties.get("description", "")
                
                steps.append({
                    "instruction": desc,
                    "latitude": lat,
                    "longitude": lon
                })
            
            elif geometry.get("type") == "LineString":
                # TMAP LineString은 [[lon, lat], [lon, lat], ...] 형태
                coordinates = geometry["coordinates"]
                for coord in coordinates:
                    # [lon, lat] -> {lat, lng} 객체로 변환하여 추가 (또는 그냥 배열로)
                    # 프론트엔드 편의를 위해 {lat, lng} 객체 리스트로 반환
                    # DebugMap은 이 path를 Polyline으로 그립니다.
                    path_coords.append({
                        "latitude": coord[1],
                        "longitude": coord[0]
                    })
        
        return {"status": "success", "data": steps, "path": path_coords}

    except Exception as e:
        print(f"Backend Error: {str(e)}")
        return {"status": "error", "message": str(e)}

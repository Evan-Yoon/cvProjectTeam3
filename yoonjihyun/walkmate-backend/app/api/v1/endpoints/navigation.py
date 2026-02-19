from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import json

router = APIRouter()

# TMAP API Key (Found in frontend code)
TMAP_APP_KEY = 'LefXmGgdUW7Eg07yhFjWW4tgAYVBYvtWZswQLUhj'

class NavigationRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

@router.post("/navigation/path")
async def get_walking_path(req: NavigationRequest):
    url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"

    headers = {
        "appKey": TMAP_APP_KEY,
        "Content-Type": "application/json"
    }

    data = {
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
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code != 200:
            print(f"TMAP Error: {response.text}")
            return {"status": "error", "message": "TMAP API Error"}

        result = response.json()
        features = result.get("features", [])
        
        steps = []
        path_coords = [] # ★ [추가] 경로 좌표 리스트 (배열의 배열)

        for feature in features:
            geometry = feature.get("geometry", {})
            properties = feature.get("properties", {})
            
            if geometry.get("type") == "Point":
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
                    path_coords.append({
                        "latitude": coord[1],
                        "longitude": coord[0]
                    })
        
        return {"status": "success", "data": steps, "path": path_coords}

    except Exception as e:
        print(f"Backend Error: {str(e)}")
        return {"status": "error", "message": str(e)}

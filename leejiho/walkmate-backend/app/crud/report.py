from app.core.database import db_client
import json

import logging

logger = logging.getLogger("API_LOGGER")

def parse_location(location_data):
    try:
        # Case 1: 데이터가 없을 때
        if not location_data:
            return {"latitude": 0.0, "longitude": 0.0}
        
        # Case 2: Supabase가 GeoJSON(딕셔너리)으로 줄 때 
        if isinstance(location_data, dict):
            coords = location_data.get("coordinates", [0.0, 0.0])
            return {"latitude": coords[1], "longitude": coords[0]} # [경도, 위도] 순서 주의

        # Case 3: 문자열(String)인데 JSON 형태일 때
        if isinstance(location_data, str):
            if location_data.startswith("POINT"):
                content = location_data[6:-1]
                lon, lat = map(float, content.split())
                return {"latitude": lat, "longitude": lon}
            
            # JSON 문자열인 경우
            try:
                data = json.loads(location_data)
                if "coordinates" in data:
                    coords = data["coordinates"]
                    return {"latitude": coords[1], "longitude": coords[0]}
            except:
                pass

        return {"latitude": 0.0, "longitude": 0.0}

    except Exception as e:
        logger.warning(f"⚠️ Location Parse Error: {e} | Data: {location_data}")
        return {"latitude": 0.0, "longitude": 0.0}


# 1. 신고 데이터 생성 (INSERT)
def create_report(report_data: dict):
    try:
        location_wkt = f"POINT({report_data['longitude']} {report_data['latitude']})"
        payload = {
            "item_id": report_data["item_id"],
            "user_id": report_data["user_id"],
            "location": location_wkt,
            "hazard_type": report_data["hazard_type"],
            "distance": report_data["distance"],
            "direction": report_data["direction"],
            "risk_level": report_data["risk_level"],
            "image_url": report_data["image_url"],
            "description": report_data.get("description"),
            "status": "new"
        }

        response = (
            db_client.table("reports")
            .insert(payload)
            .execute()
        )
        return response.data[0]
    except Exception as e:
        logger.error(f"❌ DB Insert Error: {e}", exc_info=True)
        raise e


# 2. 지도용 경량 데이터 조회 (SELECT - Map View)
def get_reports_for_map():
    try:
        response = (
            db_client.table("reports")
            .select("item_id, location, hazard_type, distance, direction, risk_level, status")
            .neq("status", "done")
            .execute()
        )
        
        results = []
        for item in response.data:
            coords = parse_location(item.get("location"))
            item.update(coords)
            
            # 프론트엔드에 줄 필요 없는 원본 location 데이터 삭제
            if "location" in item:
                del item["location"]
                
            results.append(item)
            
        return results
    except Exception as e:
        logger.error(f"❌ DB Select for Map Error: {e}", exc_info=True)
        raise e


# 3. 관리자 리스트용 전체 조회
def get_all_reports(skip: int = 0, limit: int = 20):
    try:
        response = (
            db_client.table("reports")
            .select("*", count="exact") 
            .order("created_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
        )
        
        processed_data = []
        for item in response.data:
            coords = parse_location(item.get("location"))
            item.update(coords)
            if "location" in item:
                del item["location"]
            processed_data.append(item)
            
        return {
            "total": response.count,
            "data": processed_data
        }
    except Exception as e:
        logger.error(f"❌ DB Select All Error: {e}", exc_info=True)
        raise e


# 4. 상태 수정
def update_report_status(item_id: str, new_status: str):
    try:
        response = (
            db_client.table("reports")
            .update({"status": new_status})
            .eq("item_id", item_id)
            .execute()
        )
        if not response.data: return None
        return response.data[0]
    except Exception as e:
        logger.error(f"❌ DB Update Error: {e}", exc_info=True)
        return None

# [추가] 히트맵 데이터 조회 (Bounding Box 필터링 적용)
def get_heatmap_data(min_lat: float, max_lat: float, min_lng: float, max_lng: float):
    try:
        # DB 내부의 공간 연산 함수(RPC)를 호출
        response = (
            db_client.rpc(
                "get_reports_in_bbox", 
                {
                    "min_lon": min_lng, "min_lat": min_lat, 
                    "max_lon": max_lng, "max_lat": max_lat
                }
            ).execute()
        )
        return response.data # DB가 이미 필터링과 JSON 변환을 끝낸 상태로 반환함
    except Exception as e:
        logger.error(f"❌ DB Select for Heatmap Error: {e}", exc_info=True)
        raise e
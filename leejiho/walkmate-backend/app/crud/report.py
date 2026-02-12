from app.core.database import db_client
import json

# [핵심 수정] 좌표 데이터가 문자열(WKT)로 오든, 딕셔너리(GeoJSON)로 오든 다 처리합니다.
def parse_location(location_data):
    try:
        # Case 1: 데이터가 없을 때
        if not location_data:
            return {"latitude": 0.0, "longitude": 0.0}
        
        # Case 2: Supabase가 GeoJSON(딕셔너리)으로 줄 때 (가장 유력!)
        # 예: {'type': 'Point', 'coordinates': [126.9, 37.5]}
        if isinstance(location_data, dict):
            coords = location_data.get("coordinates", [0.0, 0.0])
            return {"latitude": coords[1], "longitude": coords[0]} # [경도, 위도] 순서 주의

        # Case 3: 문자열(String)인데 JSON 형태일 때
        if isinstance(location_data, str):
            # "POINT(126...)" 형태인 경우 (WKT)
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
        print(f"Location Parse Error: {e} | Data: {location_data}")
        return {"latitude": 0.0, "longitude": 0.0}


# 1. 신고 데이터 생성 (INSERT)
def create_report(report_data: dict):
    # DB에 넣을 때는 WKT 포맷(문자열)으로 만들어 줍니다.
    location_wkt = f"POINT({report_data['longitude']} {report_data['latitude']})"

    payload = {
        "item_id": report_data["item_id"],
        "user_id": report_data["user_id"],
        "location": location_wkt,
        "hazard_type": report_data["hazard_type"],
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


# 2. 지도용 경량 데이터 조회 (SELECT - Map View)
def get_reports_for_map():
    try:
        response = (
            db_client.table("reports")
            .select("item_id, location, hazard_type, risk_level, status")
            .neq("status", "done")
            .execute()
        )
        
        results = []
        for item in response.data:
            # 위에서 만든 만능 번역기로 좌표 추출
            coords = parse_location(item.get("location"))
            
            # 기존 데이터에 lat/lon 추가
            item.update(coords)
            
            # 프론트엔드에 줄 필요 없는 원본 location 데이터는 삭제 (선택)
            if "location" in item:
                del item["location"]
                
            results.append(item)
            
        return results
    except Exception as e:
        print(f"DB Select Error: {e}")
        raise e


# 3. 관리자 리스트용 전체 조회
def get_all_reports(skip: int = 0, limit: int = 20):
    # [변경 1] count="exact" 추가: 데이터와 함께 전체 개수도 계산해 달라고 요청
    response = (
        db_client.table("reports")
        .select("*", count="exact") 
        .order("created_at", desc=True)
        .range(skip, skip + limit - 1)
        .execute()
    )
    
    # [변경 2] 좌표 변환 로직 (아까 만든 만능 번역기 활용)
    processed_data = []
    for item in response.data:
        coords = parse_location(item.get("location"))
        item.update(coords)
        if "location" in item:
            del item["location"]
        processed_data.append(item)
            
    # [변경 3] 리스트만 주는 게 아니라, '전체 개수'와 '데이터'를 딕셔너리로 묶어서 반환
    return {
        "total": response.count,  # Supabase가 세어준 전체 개수
        "data": processed_data    # 우리가 가공한 리스트
    }


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
        return None
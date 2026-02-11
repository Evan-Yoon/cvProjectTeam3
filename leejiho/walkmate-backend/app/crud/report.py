from app.core.database import db_client

# 1. 신고 데이터 생성 (INSERT)
def create_report(report_data: dict):
    # .insert() 결과는 리스트이므로 [0]으로 실제 데이터 추출
    response = (
        db_client.table("reports")
        .insert(report_data)
        .execute()
    )
    return response.data[0]


# 2. 지도용 경량 데이터 조회 (SELECT - Map View)
def get_reports_for_map():
    """
    지도 마커용: 이미지나 긴 설명은 빼고 위치와 상태만 조회
    """
    response = (
        db_client.table("reports")
        .select("id, latitude, longitude, hazard_type, risk_level, status")
        .neq("status", "done") # (선택) 처리 완료된 건 지도에서 제외
        .execute()
    )
    return response.data


# 3. 관리자 리스트용 전체 조회 (SELECT - List View)
def get_all_reports(skip: int = 0, limit: int = 100):
    """
    관리자 리스트용: 모든 정보 조회 + 페이지네이션
    """
    response = (
        db_client.table("reports")
        .select("*")
        .order("created_at", desc=True) # 최신순 정렬
        .range(skip, skip + limit - 1)
        .execute()
    )
    return response.data


# 4. 신고 상태 수정 (UPDATE)
def update_report_status(report_id: int, new_status: str):
    """
    특정 신고 건의 상태 변경 (예: new -> processing)
    """
    try:
        response = (
            db_client.table("reports")
            .update({"status": new_status})
            .eq("id", report_id) # 중요: 타겟 지정
            .execute()
        )
        
        # ID가 없어서 업데이트가 안 된 경우 처리
        if not response.data:
            return None
            
        return response.data[0]
        
    except Exception as e:
        print(f"Update Error: {e}")
        return None
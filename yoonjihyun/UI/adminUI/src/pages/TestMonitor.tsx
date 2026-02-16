import React, { useEffect, useState } from 'react';

// 1. 데이터 타입 정의 (백엔드 DB 스키마와 일치)
interface Report {
  item_id: string;
  created_at: string;
  hazard_type: string;
  image_url: string; // 예: "static/2024...jpg"
  description: string;
  latitude: number;
  longitude: number;
  risk_level: number;
}

const TestMonitor: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // ★ 백엔드 서버 주소 (본인의 IPv4 주소 확인 필수)
  // 안드로이드 앱에서 보낸 서버 주소와 똑같아야 합니다.
  const API_BASE_URL = "http://172.30.1.94:8000";

  // 2. 데이터 가져오기 함수
  const fetchReports = async () => {
    try {
      // 관리자용 전체 조회 API (경로가 맞는지 확인 필요)
      // 만약 404가 뜨면 백엔드 admin.py 엔드포인트를 확인해야 합니다.
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/reports?skip=0&limit=50`);

      if (response.ok) {
        const data = await response.json();
        setReports(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        console.error("데이터 가져오기 실패:", response.status);
      }
    } catch (error) {
      console.error("서버 연결 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. 3초마다 자동 새로고침 (Polling)
  useEffect(() => {
    fetchReports(); // 최초 실행
    const interval = setInterval(fetchReports, 3000); // 3초 주기
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* 상단 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📸 실시간 업로드 테스트</h1>
          <p className="text-gray-500 mt-1">앱에서 전송된 이미지가 3초마다 갱신됩니다.</p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium animate-pulse">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Live Updating
          </div>
          <p className="text-xs text-gray-400 mt-1">마지막 업데이트: {lastUpdated}</p>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && reports.length === 0 && (
        <div className="text-center py-20 text-gray-500">데이터를 불러오는 중...</div>
      )}

      {/* 데이터 없음 */}
      {!loading && reports.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
          <p className="text-xl font-bold text-gray-400">아직 접수된 신고가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-2">앱을 켜고 사진을 찍어보세요!</p>
        </div>
      )}

      {/* 이미지 그리드 (카드 리스트) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {reports.map((report) => {
          // 이미지 전체 URL 만들기
          // DB에는 'static/파일명.jpg'로 저장되어 있으므로 앞에 도메인을 붙여줍니다.
          const fullImageUrl = `${API_BASE_URL}/${report.image_url}`;

          return (
            <div key={report.item_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">

              {/* 이미지 영역 */}
              <div className="h-56 bg-gray-200 relative overflow-hidden group">
                <img
                  src={fullImageUrl}
                  alt="Report"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    // 이미지 로드 실패 시 대체 이미지
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x300?text=No+Image";
                  }}
                />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                  {report.hazard_type} (Lv.{report.risk_level})
                </div>
              </div>

              {/* 텍스트 정보 영역 */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs text-gray-500 font-mono">
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>

                <p className="text-gray-800 font-bold text-lg mb-1 truncate">
                   {report.description || "자동 촬영 데이터"}
                </p>

                <div className="mt-3 flex items-center text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                   <span className="mr-2">📍</span>
                   {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </div>

                <div className="mt-2 text-xs text-gray-400 truncate">
                  ID: {report.item_id}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestMonitor;
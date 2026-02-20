import React from 'react';

export type RiskLevel = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Resolved';
export type ReportType = 'B2B' | 'B2G';

export interface HazardData {
  id: string;
  thumbnail: string;
  riskLevel: RiskLevel;
  type: string; // e.g., "점자블록 파손", "공사 자재 방치"

  location: string;    // UI 표시용 (예: "위도: 37.xxx, 경도: 126.xxx")
  coordinates: string; // UI 표시용 (예: "거리: 2.5m | 방향: 우측")

  // ★ 추가됨: 나중에 거리에 따른 필터링이나 정렬을 할 때 쓰기 위해 원본 데이터도 유지
  distance?: number;
  direction?: string;

  timestamp: string;
  status: Status;

  // ★ 수정됨: 현재 DB 테이블(reports)에 report_type 컬럼이 없다면 에러가 날 수 있으므로 선택적(?) 속성으로 변경
  reportType?: ReportType;

  description: string;
  reporter: string;
  sensorData: {
    gyro: string;
    accel: string;
  };
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  subItems?: NavItem[];
}
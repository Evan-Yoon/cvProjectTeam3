import React from 'react';

export type RiskLevel = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Resolved';
export type ReportType = 'B2B' | 'B2G';

export interface HazardData {
  id: string;
  thumbnail: string;
  riskLevel: RiskLevel;
  type: string;

  location: string;
  coordinates: string;

  distance?: number;
  direction?: string;

  timestamp: string;
  rawTimestamp?: string; // ★ 추가됨: 차트 시간대 계산을 위한 원본 데이터 보존용
  status: Status;
  reportType?: ReportType;

  description: string;
  reporter: string;
  address?: string; // ★ 센서 데이터를 대체하는 실제 주소 데이터
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  subItems?: NavItem[];
}
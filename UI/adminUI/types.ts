import React from 'react';

// types.ts는 adminUI 여러 컴포넌트가 공유하는 데이터 모양을 정의합니다.

// 화면에서 색상/배지로 쓰는 위험도 문자열입니다. 백엔드 risk_level 숫자를 App.tsx에서 이 값으로 변환합니다.
export type RiskLevel = 'High' | 'Medium' | 'Low';
// UI 표시용 상태값입니다. 백엔드의 new/processing/done/hidden과 과거 표시 문자열을 함께 허용합니다.
export type Status = 'New' | 'Processing' | 'Done' | 'Hidden' | 'Pending' | 'In Progress' | 'Resolved';
// 향후 신고 유형 확장용 타입입니다. 현재 핵심 화면에서는 선택적으로만 사용됩니다.
export type ReportType = 'B2B' | 'B2G';

export interface HazardData {
  // item_id에서 온 고유 식별자입니다.
  id: string;
  // S3 이미지 URL 또는 placeholder 이미지 URL입니다.
  thumbnail: string;
  riskLevel: RiskLevel;
  type: string;

  // location은 화면 표시용 문자열, coordinates는 거리/방향 같은 부가 정보 문자열입니다.
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
  // Sidebar 같은 네비게이션 구조를 일반화할 때 쓰는 타입입니다.
  id: string;
  label: string;
  icon: React.ReactNode;
  subItems?: NavItem[];
}

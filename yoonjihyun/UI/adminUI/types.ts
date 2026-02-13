import React from 'react';

export type RiskLevel = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Resolved';
export type ReportType = 'B2B' | 'B2G';

export interface HazardData {
  id: string;
  thumbnail: string;
  riskLevel: RiskLevel;
  type: string; // e.g., "Pothole", "Uneven Sidewalk"
  location: string;
  coordinates: string; // lat, lng
  timestamp: string;
  status: Status;
  reportType: ReportType;
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
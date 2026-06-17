export enum AppScreen {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  RETRY = 'RETRY',
  CONFIRMATION = 'CONFIRMATION',
  GUIDING = 'GUIDING'
}

export interface NavigationState {
  currentScreen: AppScreen;
  destination: string | null;
}

// 내 위치 타입
export interface GeoLocation {
  lat: number;
  lng: number;
}

// 목적지 타입
export interface Destination {
  name: string;
  lat: number;
  lng: number;
}
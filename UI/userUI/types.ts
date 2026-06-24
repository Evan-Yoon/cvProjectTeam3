// types.ts는 여러 컴포넌트가 함께 쓰는 타입을 모아두는 파일입니다.
// 같은 타입을 App.tsx와 GuidingScreen.tsx에 각각 복사해두면 나중에 한쪽만 바뀌어 버그가 날 수 있습니다.

// AppScreen은 화면 이름을 문자열 상수로 고정한 enum입니다.
// setCurrentScreen(AppScreen.LISTENING)처럼 오타 없이 화면 전환을 표현할 수 있습니다.
export enum AppScreen {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  RETRY = 'RETRY',
  CONFIRMATION = 'CONFIRMATION',
  GUIDING = 'GUIDING'
}

// NavigationState는 현재 화면과 목적지 문자열만 저장하는 단순 상태 설계도입니다.
// 현재 App.tsx에서는 각 useState를 직접 쓰고 있어 이 타입은 확장/리팩터링용에 가깝습니다.
export interface NavigationState {
  currentScreen: AppScreen;
  destination: string | null;
}

// 내 위치 타입.
// TMAP/백엔드 API에서는 latitude/longitude라는 이름을 쓰기도 하지만,
// 앱 내부 UI에서는 짧게 lat/lng로 통일해서 다룹니다.
export interface GeoLocation {
  lat: number;
  lng: number;
}

// 목적지 타입.
// 이름은 사용자에게 읽어줄 텍스트이고, lat/lng는 경로 요청에 필요한 좌표입니다.
export interface Destination {
  name: string;
  lat: number;
  lng: number;
}

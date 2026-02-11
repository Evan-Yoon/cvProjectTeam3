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
export enum AppState {
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    CONFIRMING = 'CONFIRMING',
    NAVIGATING = 'NAVIGATING',
    RETRY = 'RETRY',
    ERROR = 'ERROR'
}

export interface DestinationInfo {
    name: string;
}

export interface WaveformProps {
    isListening: boolean;
    volume: number; // 0 to 1
}
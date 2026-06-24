// components 폴더 안에서 기존 import 경로('./utils/audio')를 유지하기 위한 재수출 파일입니다.
// 실제 구현은 src/utils/audio.ts에 있고, 여기서는 그 파일의 모든 export를 다시 내보냅니다.
// 이렇게 해두면 컴포넌트 코드를 한 번에 바꾸지 않고도 공통 유틸 위치를 정리할 수 있습니다.
export * from '../../src/utils/audio';

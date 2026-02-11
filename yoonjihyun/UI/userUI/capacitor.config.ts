import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.walkmate.app', // 본인의 패키지명 확인
  appName: 'walkmate',
  webDir: 'dist',
  server: {
    // ★ 이 부분을 'http'로 설정하여 로컬 파일 접근을 유연하게 만듭니다.
    androidScheme: 'http',
    allowNavigation: ['*'],
    cleartext: true
  }
};

export default config;
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.walkmate.app',
  appName: 'walkmate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
    cleartext: true
  },
  // ★ [추가됨] TMAP API 통신을 위한 HTTP 플러그인 설정
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
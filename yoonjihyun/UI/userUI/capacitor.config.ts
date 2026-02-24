import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.walkmate.app',
  appName: 'walkmate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*', '172.30.1.94', '172.30.1.94:8000', '172.30.1.80', '172.30.1.80:8000'],
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
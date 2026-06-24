import { CapacitorConfig } from '@capacitor/cli';

// CapacitorConfig는 Vite로 만든 웹앱을 iOS/Android 네이티브 앱 껍데기 안에 넣는 설정입니다.
const config: CapacitorConfig = {
  // appId는 네이티브 번들 식별자입니다. iOS/Android에서 앱을 구분하는 고유 이름입니다.
  appId: 'com.walkmate.app',
  appName: 'walkmate',
  // webDir은 "네이티브 앱에 복사할 웹 빌드 결과물" 폴더입니다. npm run build가 dist를 만듭니다.
  webDir: 'dist',
  server: {
    // Android WebView에서 https 스킴처럼 취급하도록 하는 Capacitor 설정입니다.
    androidScheme: 'https',
    // 앱 WebView가 이동하거나 요청할 수 있는 외부 호스트를 허용합니다. 개발 서버/백엔드 IP가 들어갑니다.
    allowNavigation: ['*', '172.30.1.94', '172.30.1.94:8000', '172.30.1.80', '172.30.1.80:8000'],
    // http 개발 서버/로컬 백엔드처럼 암호화되지 않은 요청을 허용합니다. 배포 시에는 보안 검토가 필요합니다.
    cleartext: true
  },
  // ★ [추가됨] TMAP API 통신을 위한 HTTP 플러그인 설정
  plugins: {
    CapacitorHttp: {
      // true이면 window.fetch 대신 Capacitor 네이티브 HTTP 계층을 사용할 수 있습니다.
      // 모바일 CORS/인증서 이슈를 줄이기 위해 API 파일들이 CapacitorHttp를 사용합니다.
      enabled: true,
    },
  },
};

export default config;

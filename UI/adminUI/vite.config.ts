import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// vite.config.ts는 adminUI의 개발 서버와 빌드 동작을 설정합니다.
// npm run dev / npm run build가 이 파일을 읽습니다.
export default defineConfig(({ mode }) => {
    // loadEnv는 현재 mode(development/production 등)에 맞는 .env 값을 읽어옵니다.
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // 관리자 UI는 userUI와 포트 충돌을 피하기 위해 3000번을 사용합니다.
        port: 3000,
        // 같은 네트워크의 다른 기기에서도 접근할 수 있게 모든 인터페이스에 바인딩합니다.
        host: '0.0.0.0',
      },
      // React JSX와 Fast Refresh를 Vite에서 처리하게 합니다.
      plugins: [react()],
      define: {
        // 일부 템플릿/라이브러리가 process.env.*를 참조할 수 있어 빌드 시 문자열로 치환합니다.
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // "@/..." import를 adminUI 루트 기준으로 해석합니다.
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// vite.config.ts는 개발 서버와 빌드 설정을 담당합니다.
// package.json의 "dev": "vite", "build": "vite build"가 이 설정을 읽습니다.
export default defineConfig({
  // React JSX/fast refresh 등을 Vite에서 처리하도록 하는 공식 플러그인입니다.
  plugins: [react()],
  resolve: {
    alias: {
      // "@/..."로 시작하는 import를 userUI 루트 기준 경로로 줄여 쓸 수 있게 합니다.
      '@': path.resolve(__dirname, './'),
      // tfjs-tflite의 ESM 진입점(dist/index.js)은 dist에 없는 런타임 전용
      // client(tflite_web_api_client)를 import해서 번들이 깨짐. client가 인라인되고
      // tfjs-core는 외부참조(앱의 tfjs와 동일 인스턴스 공유)하는 UMD 번들로 우회.
      '@tensorflow/tfjs-tflite': path.resolve(
        __dirname,
        'node_modules/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js'
      ),
    },
  },
  // Capacitor 앱 안에서는 웹 파일이 file/asset 경로로 로드될 수 있어 상대 경로 빌드가 안전합니다.
  base: './',
  server: {
    // 같은 Wi-Fi의 휴대폰에서 개발 서버에 접속할 수 있도록 모든 네트워크 인터페이스에 바인딩합니다.
    host: '0.0.0.0',
    headers: {
      // SharedArrayBuffer/wasm 계열 기능을 위해 브라우저 격리 헤더를 추가합니다.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

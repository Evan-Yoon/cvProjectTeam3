import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
  base: './',
  server: {
    host: '0.0.0.0',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

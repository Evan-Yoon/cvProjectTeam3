import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // ★ TFLite WASM 파일 처리를 위한 설정 추가
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@tensorflow/tfjs-tflite'], // 이걸 꼭 추가해야 에러가 안 납니다!
  },
});
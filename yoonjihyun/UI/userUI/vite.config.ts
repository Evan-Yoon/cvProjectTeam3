import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  base: './',
  // ★ TFLite WASM 파일 처리를 위한 설정 추가
  server: {
    host: '0.0.0.0', // ★ 외부 접속 허용 (폰에서 PC 접속)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@tensorflow/tfjs-tflite'], // 이걸 꼭 추가해야 에러가 안 납니다!
  },
});
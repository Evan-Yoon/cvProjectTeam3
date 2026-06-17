import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // ✅ [핵심] Vite가 빌드 시 네이티브 라이브러리를 만나면 'react-native-web'으로 대체하게 합니다.
      // 이렇게 해야 Vite가 Flow 문법(import typeof)이 섞인 네이티브 코드를 읽지 않습니다.
      'react-native': 'react-native-web',
      'react-native-vision-camera': 'react-native-web',
      'react-native-fast-tflite': 'react-native-web',
      'vision-camera-resize-plugin': 'react-native-web',
      'react-native-worklets-core': 'react-native-web',
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
  optimizeDeps: {
    // ✅ 네이티브 전용 라이브러리들을 의존성 최적화 대상에서 제외합니다.
    exclude: [
      'react-native-vision-camera',
      'react-native-fast-tflite',
      'vision-camera-resize-plugin',
      'react-native-worklets-core',
      '@tensorflow/tfjs-tflite' // 기존에 넣으신 설정도 유지합니다.
    ],
  },
});
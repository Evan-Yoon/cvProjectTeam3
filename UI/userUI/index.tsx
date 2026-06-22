import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// React.StrictMode를 제거: 개발 환경에서 useEffect가 두 번 실행되어
// TTS speak()가 중복 호출되는 문제 방지
root.render(
  <App />
);
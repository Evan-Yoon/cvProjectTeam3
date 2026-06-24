import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// index.html의 <div id="root"></div>를 찾아 React 앱을 붙일 실제 DOM 위치를 확보합니다.
const rootElement = document.getElementById('root');
if (!rootElement) {
  // root가 없으면 React를 그릴 곳이 없으므로 앱을 조용히 실패시키지 않고 즉시 에러를 냅니다.
  throw new Error("Could not find root element to mount to");
}

// createRoot는 React 18+ 방식의 렌더링 시작점입니다. 이 root 아래에서 App.tsx가 전체 화면을 관리합니다.
const root = ReactDOM.createRoot(rootElement);
// React.StrictMode를 제거: 개발 환경에서 useEffect가 두 번 실행되어
// TTS speak()가 중복 호출되는 문제 방지
root.render(
  // App은 화면 상태(IDLE/LISTENING/...)를 들고 각 화면 컴포넌트를 선택해서 보여주는 최상위 컴포넌트입니다.
  <App />
);

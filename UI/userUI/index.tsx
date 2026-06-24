import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// index.html의 <div id="root"></div>를 찾아 React 앱을 붙일 실제 DOM 위치를 확보합니다.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// createRoot는 React 18+ 방식의 렌더링 시작점입니다. 이 root 아래에서 App.tsx가 전체 화면을 관리합니다.
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

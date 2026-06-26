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
  // React.StrictMode: 개발 환경에서 컴포넌트의 잠재적인 버그(메모리 누수, 정리되지 않은 이벤트 등)를
  // 감지하기 위해 의도적으로 컴포넌트를 두 번씩 렌더링/마운트하는 검사 도구입니다. (실제 배포 빌드 시에는 작동하지 않음)
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

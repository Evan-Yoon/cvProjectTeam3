import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// index.html의 <div id="root"></div>가 React 앱이 들어갈 DOM 컨테이너입니다.
const rootElement = document.getElementById('root');
if (!rootElement) {
  // root가 없으면 화면을 렌더링할 수 없으므로 명확한 에러를 던집니다.
  throw new Error("Could not find root element to mount to");
}

// React 18+ 방식의 렌더링 루트입니다.
const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode는 개발 중 부작용이 있는 effect를 찾기 위해 일부 로직을 한 번 더 실행할 수 있습니다.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // ★ 해/달 토글 버튼을 작동하게 하는 핵심 설정
    content: [
        // Tailwind가 className을 스캔할 파일 목록입니다. 여기에 없으면 해당 class가 빌드 CSS에서 빠질 수 있습니다.
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        // extend 안에 색상/폰트/간격 등을 추가하면 기본 Tailwind 토큰을 유지하면서 확장할 수 있습니다.
        extend: {},
    },
    // Tailwind 플러그인이 필요하면 여기에 추가합니다.
    plugins: [],
}

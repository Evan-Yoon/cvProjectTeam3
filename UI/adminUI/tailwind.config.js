/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // ★ 해/달 토글 버튼을 작동하게 하는 핵심 설정
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
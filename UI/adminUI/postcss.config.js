// PostCSS는 CSS를 빌드 과정에서 변환하는 도구입니다.
// Tailwind와 autoprefixer가 index.css를 실제 브라우저용 CSS로 처리합니다.
export default {
    plugins: {
        // Tailwind v4 계열 PostCSS 플러그인입니다.
        "@tailwindcss/postcss": {},
        // 브라우저 호환성을 위해 필요한 vendor prefix를 자동으로 붙입니다.
        autoprefixer: {},
    },
};

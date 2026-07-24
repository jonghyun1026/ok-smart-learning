import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          // OK금융그룹 디지털 UI 디자인 가이드 v1.0 토큰에 맞춤
          DEFAULT: "#F55000", // OK Orange — Primary Action·선택·핵심 강조
          deep: "#D94300", // Primary Hover·강한 강조
          light: "#FF7A47", // 그라디언트 보조(밝은 오렌지)
          dark: "#2A232A", // 강한 텍스트·다크 표면
          dark2: "#3F363F", // 다크 표면 보조(그라디언트)
          brown: "#55474A", // 제목·KPI·차트 선(웜 브라운)
          brown2: "#6C5C60", // 보조 헤딩
          muted: "#786F71", // 설명·축·보조 라벨
          border: "#EBE7E3", // 카드·행 구분선
          borderStrong: "#DDD7D2", // 입력·버튼 경계
          bg: "#F6F5F3", // 전체 앱 배경(웜 그레이)
          alt: "#FAF9F8", // 테이블 헤더·교차 행
          highlight: "#FFF1E9", // Orange Soft — 선택 배경·배지·아이콘 타일
          hoverSoft: "#FFFBF8", // 테이블 행 hover
          green: "#18875E", // 완료·긍정 상태
          greenLight: "#4CAF50",
          red: "#C6362B",
          amber: "#FFAA00", // OK Yellow — 보조 지표·진행 상태
          amberLight: "#FFC247",
          yellowSoft: "#FFF7DF", // 주의·진행 상태 연한 배경
        },
      },
      fontFamily: {
        sans: ["'Noto Sans KR'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // OK 디자인 가이드 6장 표면 규격
        card: "20px",
        control: "11px",
        popover: "14px",
      },
      boxShadow: {
        // 웜 그림자(브라운 기반, 낮은 대비) + Primary 오렌지 글로우
        card: "0 14px 42px rgba(85, 71, 74, 0.075)",
        cardHover: "0 18px 48px rgba(85, 71, 74, 0.12)",
        primary: "0 10px 20px rgba(245, 80, 0, 0.18)",
        pop: "0 18px 48px rgba(85, 71, 74, 0.18)",
      },
    },
  },
  plugins: [],
};
export default config;

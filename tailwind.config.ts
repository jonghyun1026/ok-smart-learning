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
          DEFAULT: "#F04E23",
          light: "#FF7A47",
          dark: "#2A232A",
          dark2: "#3F363F",
          muted: "#8A7F86",
          border: "#E8E2DD",
          bg: "#F5F3EF",
          alt: "#FAF8F5",
          highlight: "#FDEDE7",
          green: "#2E7D32",
          greenLight: "#4CAF50",
          red: "#C6362B",
          amber: "#FF9900",
          amberLight: "#FFC247",
        },
      },
      fontFamily: {
        sans: ["'Noto Sans KR'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

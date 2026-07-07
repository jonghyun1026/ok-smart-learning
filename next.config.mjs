/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse(내부적으로 pdfjs-dist)가 webpack RSC 번들링 시 "Object.defineProperty called on
  // non-object" 오류를 일으키므로, 해당 패키지들은 번들링하지 않고 런타임에 그대로 require하도록
  // 서버 전용 외부 패키지로 지정한다 (AI 평가 에이전트, docs/schema.md 2.6절).
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
  },
};

export default nextConfig;

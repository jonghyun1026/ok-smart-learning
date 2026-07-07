import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "OK학당 스마트러닝 위탁운영 계약 평가시스템",
  description:
    "OK금융그룹 2025~2026년 OK학당 스마트러닝 교육 위탁운영 용역 입찰·평가 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} font-sans antialiased bg-brand-bg text-brand-dark`}>
        <TopNav />
        {children}
      </body>
    </html>
  );
}

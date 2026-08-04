import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RateYourCommit",
  description:
    "개발팀의 기여를 투명하게, 설명 가능하게 — 오픈소스 개발자 성과 가시화 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

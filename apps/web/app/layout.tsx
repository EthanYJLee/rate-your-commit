import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "../auth";

export const metadata: Metadata = {
  title: "RateYourCommit",
  description:
    "개발팀의 기여를 투명하게, 설명 가능하게 — 오픈소스 개발자 성과 가시화 도구",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="ko">
      <body>
        {session && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: ".6rem",
              alignItems: "center",
              padding: ".6rem 1.5rem",
              fontSize: ".8rem",
              color: "var(--ink-soft)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span>{session.user?.name ?? session.user?.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                style={{
                  font: "inherit",
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                로그아웃
              </button>
            </form>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}

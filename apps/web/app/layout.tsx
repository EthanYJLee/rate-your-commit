import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "../auth";
import { NavLinks } from "../components/NavLinks";

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
          <header className="topnav">
            <a href="/" className="topnav__brand">
              RateYourCommit
            </a>
            <NavLinks />
            <div className="topnav__user">
              <span>{session.user?.name ?? session.user?.email}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button type="submit" className="topnav__signout">
                  로그아웃
                </button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}

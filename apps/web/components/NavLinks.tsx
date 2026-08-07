"use client";

import { usePathname } from "next/navigation";
import type { AppRole } from "../lib/admin-role";

const LINKS = [
  { href: "/", label: "대시보드", adminOnly: false },
  { href: "/identities", label: "아이덴티티", adminOnly: true },
  { href: "/scorecard", label: "스코어카드", adminOnly: false },
  { href: "/settings/weights", label: "가중치 설정", adminOnly: true },
  { href: "/settings/teams", label: "팀 설정", adminOnly: true },
  { href: "/settings/app-users", label: "계정 관리", adminOnly: true },
] as const;

/**
 * The only client component in the app — needed purely to highlight
 * the current route in the nav bar. Everything else stays server
 * components + plain form actions on purpose.
 *
 * `role` comes from the server-rendered layout's session — a member
 * never sees a link to a page proxy.ts would just bounce them out of
 * (see lib/request-guard.ts for the actual enforcement; this is UX
 * only, not itself an access control).
 */
export function NavLinks({ role }: { role?: AppRole }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <nav className="topnav__links">
      {LINKS.filter((link) => !link.adminOnly || isAdmin).map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={`topnav__link${pathname === link.href ? " is-active" : ""}`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

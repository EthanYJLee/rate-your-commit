"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/identities", label: "아이덴티티" },
  { href: "/scorecard", label: "스코어카드" },
  { href: "/settings/weights", label: "가중치 설정" },
  { href: "/settings/teams", label: "팀 설정" },
] as const;

/**
 * The only client component in the app — needed purely to highlight
 * the current route in the nav bar. Everything else stays server
 * components + plain form actions on purpose.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="topnav__links">
      {LINKS.map((link) => (
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

import type { DefaultSession } from "next-auth";
import type { AppRole } from "./lib/admin-role";

// Extends NextAuth's default types with the GitHub `login` we persist
// via lib/auth-session.ts — see that file for why. `personId` is the
// same idea for Credentials (AppUser) sign-ins: set only when an
// admin has linked that AppUser to a Person on /settings/app-users
// (convenience — a "내 스코어카드" link — not an access restriction).
// `role` IS the access-control mechanism (see lib/request-guard.ts) —
// unlike login/personId, proxy.ts actively branches on it.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      login?: string;
      personId?: string;
      role?: AppRole;
      /** "github" | "credentials" — which provider this session signed
       * in with. Lets proxy.ts's live role re-check (see
       * lib/resolve-effective-role.ts) branch correctly; not itself
       * an access restriction. */
      provider?: "github" | "credentials";
      /** token.sub, carried onto the session — the AppUser row's own
       * id for a Credentials sign-in (GitHub sign-ins get GitHub's own
       * numeric id here instead, unused by anything today). */
      id?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
    personId?: string;
    role?: AppRole;
    provider?: "github" | "credentials";
  }
}

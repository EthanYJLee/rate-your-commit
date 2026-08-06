import type { DefaultSession } from "next-auth";

// Extends NextAuth's default types with the GitHub `login` we persist
// via lib/auth-session.ts — see that file for why. `personId` is the
// same idea for Credentials (AppUser) sign-ins: set only when an
// admin has linked that AppUser to a Person on /settings/app-users
// (convenience — a "내 스코어카드" link — not an access restriction).
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      login?: string;
      personId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
    personId?: string;
  }
}

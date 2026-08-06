import type { DefaultSession } from "next-auth";

// Extends NextAuth's default types with the GitHub `login` we persist
// via lib/auth-session.ts — see that file for why.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      login?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
  }
}

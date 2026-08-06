import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { isLoginAllowed, parseAllowedLogins } from "./lib/auth-allowlist";
import { attachLoginToSession, attachLoginToToken } from "./lib/auth-session";

/**
 * GitHub OAuth only for v1 (email/password deferred — see
 * docs/ARCHITECTURE.md §1). JWT sessions: no Prisma adapter, no
 * User/Session tables — nothing to persist for a single signed-in
 * identity in this MVP. Linking a signed-in user to a Person is a
 * later concern.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ profile }) {
      const allowedLogins = parseAllowedLogins(process.env.ALLOWED_GITHUB_LOGINS);
      const login = (profile as { login?: string } | undefined)?.login;
      return isLoginAllowed(login, allowedLogins);
    },
    async jwt({ token, profile }) {
      return attachLoginToToken(token, profile as { login?: string } | undefined);
    },
    async session({ session, token }) {
      return attachLoginToSession(session, token);
    },
  },
});

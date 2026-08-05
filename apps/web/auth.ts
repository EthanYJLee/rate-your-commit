import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { isLoginAllowed, parseAllowedLogins } from "./lib/auth-allowlist";

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
      const allowed = isLoginAllowed(login, allowedLogins);
      // TEMP diagnostic — remove once the redirect-loop is confirmed fixed.
      console.log("[auth] signIn callback", {
        profileLogin: login,
        profileKeys: profile ? Object.keys(profile) : null,
        allowedLogins,
        allowed,
      });
      return allowed;
    },
  },
});

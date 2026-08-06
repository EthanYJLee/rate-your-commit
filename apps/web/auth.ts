import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { isLoginAllowed, parseAllowedLogins } from "./lib/auth-allowlist";
import { attachLoginToSession, attachLoginToToken, attachPersonIdToToken } from "./lib/auth-session";
import { authenticateAppUser } from "./lib/authenticate-app-user";

/**
 * Two sign-in paths, additive (see docs/ARCHITECTURE.md §1 for the
 * original GitHub-only v1 decision, extended per user request):
 *
 * - GitHub OAuth, gated by ALLOWED_GITHUB_LOGINS (lib/auth-allowlist.ts,
 *   fails closed).
 * - Email/password via the Credentials provider, backed by the
 *   AppUser table (lib/authenticate-app-user.ts). Admin-provisioned
 *   only (/settings/app-users) — no public self-registration, so this
 *   needs no separate allowlist: an AppUser row existing IS the grant.
 *
 * Still JWT sessions, still no Prisma Adapter — AppUser is a plain
 * lookup table for authorize(), not an Auth.js Adapter User (see its
 * schema doc comment). An AppUser can be linked to a Person
 * (/settings/app-users) — convenience only (session.personId powers a
 * "내 스코어카드" link), not an access restriction; see
 * next-auth.d.ts. GitHub sign-ins have no equivalent yet (that path
 * has no persisted row at all to attach a link to).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password =
          typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;
        return authenticateAppUser(email, password);
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      // The Credentials provider already did its own authorization
      // inside authorize() above (returning null blocks the sign-in
      // before this callback even runs) — the GitHub allowlist check
      // below only applies to the GitHub provider.
      if (account?.provider !== "github") return true;

      const allowedLogins = parseAllowedLogins(process.env.ALLOWED_GITHUB_LOGINS);
      const login = (profile as { login?: string } | undefined)?.login;
      return isLoginAllowed(login, allowedLogins);
    },
    async jwt({ token, profile, user }) {
      const withLogin = attachLoginToToken(
        token,
        profile as { login?: string } | undefined,
        user as { email?: string | null } | undefined
      );
      return attachPersonIdToToken(withLogin, user as { personId?: string | null } | undefined);
    },
    async session({ session, token }) {
      return attachLoginToSession(session, token);
    },
  },
});

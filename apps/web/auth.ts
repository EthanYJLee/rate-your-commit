import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { AppRole } from "./lib/admin-role";
import { isLoginAllowed, parseAllowedLogins } from "./lib/auth-allowlist";
import {
  attachLoginToSession,
  attachLoginToToken,
  attachPersonIdToToken,
  attachProviderToToken,
  attachRoleToToken,
} from "./lib/auth-session";
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
 *
 * `session.user.role` (admin/member) IS an access restriction —
 * proxy.ts gates /identities and /settings/* on it. GitHub's role
 * comes from ADMIN_GITHUB_LOGINS (lib/admin-role.ts, grandfathers
 * everyone to admin when unset); Credentials' role comes straight off
 * the AppUser row (lib/authenticate-app-user.ts).
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
    async jwt({ token, profile, user, account }) {
      const withLogin = attachLoginToToken(
        token,
        profile as { login?: string } | undefined,
        user as { email?: string | null } | undefined
      );
      const withPersonId = attachPersonIdToToken(
        withLogin,
        user as { personId?: string | null } | undefined
      );
      const withProvider = attachProviderToToken(
        withPersonId,
        account as { provider?: string } | undefined
      );
      const adminLogins = parseAllowedLogins(process.env.ADMIN_GITHUB_LOGINS);
      return attachRoleToToken(
        withProvider,
        profile as { login?: string } | undefined,
        user as { role?: AppRole } | undefined,
        adminLogins
      );
    },
    async session({ session, token }) {
      return attachLoginToSession(session, token);
    },
  },
});

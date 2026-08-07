import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { AppRole } from "./admin-role";
import { resolveGithubRole } from "./admin-role";

/**
 * NextAuth's default GitHub profile mapping only keeps name/email/
 * image on the session — not the GitHub `login` (username), even
 * though auth-allowlist.ts already treats login as the authoritative
 * identity for sign-in. Persisting it onto the JWT the first time a
 * `profile` is present (right after sign-in) makes it available for
 * the life of the session, so audit logging (S-07 merge/unmerge/split)
 * can record a real actor instead of the possibly-blank/non-unique
 * display name.
 *
 * `user` is the Credentials provider's fallback identity: its
 * authorize() callback (see auth.ts) has no GitHub `profile`, only
 * the AppUser it looked up — so an email/password sign-in's audit-log
 * actor is their email instead. profile.login wins when both are
 * present (shouldn't happen in practice — one sign-in uses one
 * provider — but GitHub's real account identity is preferred if it
 * ever does).
 */
export function attachLoginToToken(
  token: JWT,
  profile: { login?: string } | undefined,
  user?: { email?: string | null }
): JWT {
  const login = profile?.login ?? user?.email ?? undefined;
  if (!login) return token;
  return { ...token, login };
}

/**
 * Persists the Credentials (AppUser) sign-in's linked Person, if any
 * — an admin sets this on /settings/app-users, never derived from
 * GitHub. Convenience only (see next-auth.d.ts's doc comment): used
 * to surface a "내 스코어카드" link, not to restrict access.
 */
export function attachPersonIdToToken(token: JWT, user?: { personId?: string | null }): JWT {
  const personId = user?.personId;
  if (!personId) return token;
  return { ...token, personId };
}

/**
 * Determines the signed-in role (admin vs member — see
 * lib/request-guard.ts for what each level can reach) at the moment
 * of a fresh sign-in, the same "only when profile/user is actually
 * present this request" branching as attachLoginToToken above:
 *
 * - GitHub: `profile.login` is only present right after a fresh
 *   OAuth sign-in, so that's when resolveGithubRole() computes the
 *   role from ADMIN_GITHUB_LOGINS.
 * - Credentials: `user.role` comes straight from the AppUser row
 *   authenticateAppUser() looked up.
 *
 * On every OTHER request (an existing session just being refreshed),
 * neither is present — the token already carries whatever role was
 * set at sign-in time, so it's left untouched rather than silently
 * dropped.
 */
export function attachRoleToToken(
  token: JWT,
  profile: { login?: string } | undefined,
  user: { role?: AppRole } | undefined,
  adminLogins: string[]
): JWT {
  if (profile?.login) {
    return { ...token, role: resolveGithubRole(profile.login, adminLogins) };
  }
  if (user?.role) {
    return { ...token, role: user.role };
  }
  return token;
}

/**
 * Persists which provider this sign-in used (only set when `account`
 * is present — a fresh sign-in, same "only this request" branching as
 * every other attach* function here). Lets proxy.ts's live role
 * re-check (lib/resolve-effective-role.ts) know whether to re-derive
 * the role from ADMIN_GITHUB_LOGINS (GitHub) or re-query the AppUser
 * row (Credentials) instead of trusting the token's cached role.
 */
export function attachProviderToToken(
  token: JWT,
  account: { provider?: string } | undefined
): JWT {
  if (account?.provider !== "github" && account?.provider !== "credentials") return token;
  return { ...token, provider: account.provider };
}

export function attachLoginToSession(session: Session, token: JWT): Session {
  if (!session.user) return session;

  const withLogin = token.login ? { ...session.user, login: token.login } : session.user;
  const withPersonId = token.personId
    ? { ...withLogin, personId: token.personId }
    : withLogin;
  const withRole = token.role ? { ...withPersonId, role: token.role } : withPersonId;
  const withProvider = token.provider ? { ...withRole, provider: token.provider } : withRole;
  // token.sub is set by Auth.js itself from the sign-in user's `id`
  // (GitHub's own numeric id, or the AppUser row's id for
  // Credentials) — not something any attach* function here computes.
  const withId = token.sub ? { ...withProvider, id: token.sub } : withProvider;

  return { ...session, user: withId };
}

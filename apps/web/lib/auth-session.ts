import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

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

export function attachLoginToSession(session: Session, token: JWT): Session {
  if (!session.user) return session;

  const withLogin = token.login ? { ...session.user, login: token.login } : session.user;
  const withPersonId = token.personId
    ? { ...withLogin, personId: token.personId }
    : withLogin;

  return { ...session, user: withPersonId };
}

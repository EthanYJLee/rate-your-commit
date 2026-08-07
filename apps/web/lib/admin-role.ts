export type AppRole = "admin" | "member";

/**
 * Determines a GitHub sign-in's role (admin vs member — see
 * lib/request-guard.ts for what each level can reach). Takes an
 * already-parsed admin-login list, same shape as isLoginAllowed takes
 * an already-parsed allowlist — parse ADMIN_GITHUB_LOGINS once via
 * parseAllowedLogins() at the call site (auth.ts), not in here.
 *
 * Deliberately the OPPOSITE default direction from auth-allowlist.ts's
 * fail-closed philosophy, on purpose: ALLOWED_GITHUB_LOGINS answers
 * "who may sign in at all" (unset = nobody), while ADMIN_GITHUB_LOGINS
 * answers "which already-signed-in people get admin" on an app that,
 * before this role concept existed, gave every allowed login full
 * access. An unset/empty ADMIN_GITHUB_LOGINS therefore grandfathers
 * every allowed login to admin — the non-breaking default for
 * existing deployments — rather than silently locking everyone down
 * to member the moment this ships. Once an operator sets
 * ADMIN_GITHUB_LOGINS explicitly, only logins in that list get admin;
 * every other allowed login becomes member.
 */
export function resolveGithubRole(login: string | undefined, adminLogins: string[]): AppRole {
  if (adminLogins.length === 0) return "admin";
  if (!login) return "member";
  return adminLogins.includes(login.toLowerCase()) ? "admin" : "member";
}

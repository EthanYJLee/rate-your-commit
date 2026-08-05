/**
 * GitHub OAuth alone doesn't restrict WHO can sign in — any GitHub
 * account in the world can complete the OAuth flow. This allowlist is
 * the actual access-control layer: only logins listed in
 * ALLOWED_GITHUB_LOGINS (comma-separated) may sign in.
 *
 * Deliberately fails CLOSED: an unset/empty allowlist means "nobody
 * is configured yet", not "everybody's allowed". An admin must
 * explicitly opt people in.
 */

export function parseAllowedLogins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

export function isLoginAllowed(login: string | undefined, allowedLogins: string[]): boolean {
  if (!login) return false;
  if (allowedLogins.length === 0) return false;
  return allowedLogins.includes(login.toLowerCase());
}

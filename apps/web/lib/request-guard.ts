/**
 * Everything proxy.ts needs to decide, kept as plain testable
 * functions (proxy.ts itself is Next.js middleware — hard to unit
 * test directly — so the actual decision logic lives here, same
 * split as auth-allowlist.ts/isLoginAllowed).
 */

/**
 * Pages and API routes that only an admin role may reach — every
 * other signed-in session gets bounced (see proxy.ts). Everything NOT
 * listed here (the dashboard, /scorecard and its drill-down) stays
 * open to any signed-in user, admin or member.
 *
 * /api/people covers only /api/people/[id]/team today (the
 * /settings/teams page's per-person assignment) — there is no other
 * /api/people/* route, so gating the whole prefix is correct as of
 * this writing; revisit if that ever changes.
 *
 * /api/scorecard covers only /api/scorecard/confirm (S-06's "확정"
 * action) — the /scorecard PAGE itself stays open to any signed-in
 * user (it queries Prisma directly server-side, no GET API route), so
 * only the /api/scorecard/* mutation prefix is admin-only, not
 * /scorecard itself.
 */
const ADMIN_ONLY_PREFIXES = [
  "/identities",
  "/settings",
  "/api/identities",
  "/api/settings",
  "/api/people",
  "/api/scorecard",
];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Methods that don't mutate state — never subject to the CSRF check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutatingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * CSRF defense-in-depth for the app's own /api/* mutating routes
 * (all plain HTML-form POSTs, no client-side fetch). SameSite=Lax
 * cookies already stop a classic cross-site <form> auto-submit in
 * every modern browser, since Lax only exempts top-level GET
 * navigations — this is an extra layer, not the only one, and
 * doesn't require touching any existing form or issuing a token.
 *
 * Requires Origin to be PRESENT and equal to the request's own
 * origin — a same-origin browser POST always sends Origin, so a
 * missing header is treated as suspicious (a very old browser or a
 * non-browser client) rather than silently allowed.
 */
export function isOriginValid(originHeader: string | null, requestOrigin: string): boolean {
  if (!originHeader) return false;
  return originHeader === requestOrigin;
}

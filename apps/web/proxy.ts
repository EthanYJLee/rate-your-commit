import { NextResponse } from "next/server";
import { auth } from "./auth";
import { isAdminOnlyPath, isMutatingMethod, isOriginValid } from "./lib/request-guard";
import { resolveEffectiveRole, type SessionUserForRoleCheck } from "./lib/resolve-effective-role";

export default auth(async (req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  // CSRF (backlog #6): every mutating /api/* request (all of them are
  // plain HTML-form POSTs today) must carry an Origin header matching
  // this app's own origin. See lib/request-guard.ts's doc comment for
  // why this is defense-in-depth on top of SameSite=Lax, not the only
  // layer.
  if (isApiRoute && isMutatingMethod(req.method)) {
    if (!isOriginValid(req.headers.get("origin"), req.nextUrl.origin)) {
      return NextResponse.json({ error: "Invalid or missing Origin header." }, { status: 403 });
    }
  }

  // RBAC (backlog #6): admin-only pages/routes reject anything but a
  // CURRENTLY-admin session. Deliberately re-derived per request
  // (see lib/resolve-effective-role.ts) rather than trusting the
  // JWT's cached role — this app's rolling 30-day JWT sessions would
  // otherwise let a just-revoked AppUser or a login just removed from
  // ADMIN_GITHUB_LOGINS keep admin access until that specific session
  // happened to refresh, which could be indefinitely for an active
  // user. Scoped to this admin-only boundary only, not every request,
  // to avoid adding a DB round-trip to the whole app.
  if (isAdminOnlyPath(pathname)) {
    const effectiveRole = await resolveEffectiveRole(
      req.auth.user as SessionUserForRoleCheck | undefined
    );
    if (effectiveRole !== "admin") {
      if (isApiRoute) {
        return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
      }
      const url = new URL("/", req.url);
      url.searchParams.set("error", "관리자 전용 페이지입니다.");
      return NextResponse.redirect(url);
    }
  }
});

/**
 * Protects every route except NextAuth's own callback/API routes,
 * the login page itself, and static assets — otherwise those would
 * redirect-loop against the very check that's supposed to let you
 * reach them. /api/auth/* keeps relying on Auth.js's own built-in
 * CSRF protection for the sign-in flow itself, untouched by the
 * Origin check above.
 */
export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};

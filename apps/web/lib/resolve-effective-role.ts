import { prisma } from "@rateyourcommit/db";
import type { AppRole } from "./admin-role";
import { resolveGithubRole } from "./admin-role";
import { parseAllowedLogins } from "./auth-allowlist";

export interface SessionUserForRoleCheck {
  provider?: "github" | "credentials";
  login?: string;
  id?: string;
}

/**
 * Re-derives the CURRENT role for a signed-in session instead of
 * trusting the JWT's cached `role` — called only on the admin-only
 * boundary (see proxy.ts), not on every request, so a revoked AppUser
 * or a login removed from ADMIN_GITHUB_LOGINS loses admin access on
 * its very next request to an admin-only page, instead of whenever
 * that session's (potentially long-lived, rolling) JWT next happens
 * to refresh its cached role. See auth-session.ts's attachRoleToToken
 * for why the cached value alone isn't sufficient on its own.
 */
export async function resolveEffectiveRole(
  user: SessionUserForRoleCheck | undefined
): Promise<AppRole> {
  if (!user) return "member";

  if (user.provider === "github") {
    const adminLogins = parseAllowedLogins(process.env.ADMIN_GITHUB_LOGINS);
    return resolveGithubRole(user.login, adminLogins);
  }

  if (user.provider === "credentials" && user.id) {
    const appUser = await prisma.appUser.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    // Row gone (revoked since sign-in) — treated the same as
    // "member", i.e. no admin access, which is exactly what a revoked
    // account should get.
    return appUser?.role ?? "member";
  }

  return "member";
}

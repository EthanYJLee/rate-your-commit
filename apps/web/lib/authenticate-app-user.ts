import { prisma } from "@rateyourcommit/db";
import { checkAndConsumeAttempt, clearFailedAttempts } from "./login-rate-limit";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "./password";

export interface AuthenticatedAppUser {
  id: string;
  email: string;
  /** Null unless an admin linked this account to a Person on
   * /settings/app-users — see AppUser.personId's schema doc comment. */
  personId: string | null;
}

/**
 * Looks up an AppUser by email and verifies the password — the
 * Credentials provider's authorize() callback (see auth.ts) just
 * wraps this. Extracted for unit testing without a real NextAuth
 * request/response cycle.
 *
 * Returns null (never throws) on any failure — missing input,
 * unknown email, wrong password, or rate-limited — deliberately
 * uniform so a caller/attacker can't distinguish "no such account"
 * from "wrong password" from "locked out" by response shape, only by
 * the generic sign-in error page.
 */
export async function authenticateAppUser(
  email: string,
  password: string
): Promise<AuthenticatedAppUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;
  // Reject oversized input before any expensive work (scrypt, even a
  // DB round-trip) — see MAX_PASSWORD_LENGTH's doc comment.
  if (password.length > MAX_PASSWORD_LENGTH) return null;

  // Atomically checks AND consumes one attempt slot for this window —
  // see login-rate-limit.ts's doc comment for why this must be a
  // single synchronous call rather than "check, then later record"
  // (the latter races under concurrent requests).
  if (!checkAndConsumeAttempt(normalizedEmail)) return null;

  const user = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return null;

  clearFailedAttempts(normalizedEmail);
  return { id: user.id, email: user.email, personId: user.personId };
}

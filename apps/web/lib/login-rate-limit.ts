/**
 * In-memory sliding-window lockout for the Credentials provider's
 * authorize() callback (see auth.ts) — "Rate limiting on all
 * endpoints" per the security checklist, and this project's first
 * password-guessable surface. Reviewed by security-reviewer; two
 * findings addressed here:
 *
 * - Concurrency: the check and the increment are ONE synchronous
 *   operation (checkAndConsumeAttempt), not a separate "check, then
 *   later record" pair. An earlier version raced under concurrent
 *   requests — N simultaneous callers could all pass a stale check
 *   before any of them recorded a failure. Since Node runs
 *   synchronous code to completion before yielding, doing both steps
 *   in one non-async function closes that gap: no `await` exists
 *   between the read and the write.
 * - Unbounded growth: attemptsByEmail had no eviction, so an attacker
 *   cycling through many distinct emails could grow it forever
 *   (memory-exhaustion DoS on this single-process deployment — see
 *   docker-compose.yml). sweepExpired() runs opportunistically once
 *   the map crosses MAX_TRACKED_KEYS, bounding worst-case size.
 *
 * Still a v1 tradeoff: in-memory, per-process, resets on restart,
 * doesn't coordinate across replicas, and only protects a single
 * account from being hammered (not the whole user base from
 * distributed credential stuffing — that needs a per-IP/global limit,
 * out of scope here). Revisit with a shared store (Redis, a DB table)
 * only if the deployment shape or threat model changes.
 */
export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_TRACKED_KEYS = 10_000;

interface AttemptWindow {
  count: number;
  windowStart: number;
}

const attemptsByEmail = new Map<string, AttemptWindow>();

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function isExpired(window: AttemptWindow, now: number): boolean {
  return now - window.windowStart > WINDOW_MS;
}

function sweepExpired(now: number): void {
  for (const [key, window] of attemptsByEmail) {
    if (isExpired(window, now)) attemptsByEmail.delete(key);
  }
}

/**
 * Atomically checks whether `email` is still under MAX_ATTEMPTS for
 * its current window AND consumes one attempt slot if so — the only
 * entry point for recording a login attempt. Returns false (caller
 * must not proceed) once the window's count reaches MAX_ATTEMPTS.
 */
export function checkAndConsumeAttempt(email: string): boolean {
  const key = normalize(email);
  const now = Date.now();

  if (attemptsByEmail.size > MAX_TRACKED_KEYS) sweepExpired(now);

  const existing = attemptsByEmail.get(key);
  if (!existing || isExpired(existing, now)) {
    attemptsByEmail.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= MAX_ATTEMPTS) return false;
  existing.count += 1;
  return true;
}

/** Called on successful login so a legitimate sign-in isn't left one
 * typo away from a lockout it doesn't deserve. */
export function clearFailedAttempts(email: string): void {
  attemptsByEmail.delete(normalize(email));
}

/** Test-only introspection hook. */
export function trackedKeyCount(): number {
  return attemptsByEmail.size;
}

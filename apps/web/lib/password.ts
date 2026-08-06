import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Floor for admin-set initial passwords on /settings/app-users — this
 * project has no password-reset flow (no email infra), so an admin
 * sets these directly; still worth a minimum to avoid trivially weak
 * values. Validate against this at the API boundary, not just here.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * scrypt is deliberately CPU/memory-expensive by design — without an
 * upper bound, an unauthenticated caller could submit an arbitrarily
 * large password and force full scrypt cost on every attempt
 * (flagged in security review as a CPU-exhaustion amplification
 * vector, worse combined with many distinct emails). No legitimate
 * password needs to be this long.
 */
export const MAX_PASSWORD_LENGTH = 256;

/**
 * scrypt (Node's built-in crypto module, no new dependency) rather
 * than bcrypt/argon2 — this project has consistently avoided adding
 * SDK dependencies where a native/built-in option suffices (see the
 * GitLab/Jira/Linear connectors' native-fetch choices). scrypt is an
 * OWASP-acceptable password KDF. Stored as "saltHex:hashHex" — never
 * the plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Timing-safe comparison — a plain `===` on the derived hashes would
 * leak how many leading bytes matched via response-time differences.
 * Malformed `stored` values (wrong shape, empty string) fail closed
 * (return false) rather than throwing, so a corrupted AppUser row
 * can't turn into an unhandled 500 on login.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hashHex, "hex");
  if (derivedKey.length !== storedKey.length) return false;

  return timingSafeEqual(derivedKey, storedKey);
}

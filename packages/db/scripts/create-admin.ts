/**
 * Bootstraps (or resets) an admin AppUser account — solves the
 * chicken-and-egg problem for a deployment that wants Credentials
 * (email/password) sign-in without ever configuring GitHub OAuth:
 * creating an AppUser normally requires hitting an admin-only route
 * (/settings/app-users), but a fresh deployment has no admin yet.
 * Re-running for an existing email resets their password and
 * (re-)grants admin — also doubles as an "I forgot my admin password"
 * recovery path via CLI/server access, consistent with this project's
 * existing "admin revokes+reissues, no password-reset flow" design
 * (see apps/web/app/settings/app-users/page.tsx).
 *
 * Password hashing is deliberately DUPLICATED from
 * apps/web/lib/password.ts rather than imported — packages/db is a
 * shared package apps/web depends ON, not the other way around, and
 * this algorithm (Node's built-in scrypt, no external dependency) is
 * simple enough that duplicating it here is safer than introducing a
 * reverse dependency between packages. If you change the hashing
 * scheme in apps/web/lib/password.ts, update this file to match.
 *
 * Usage:
 *   npm run create-admin -w packages/db -- you@example.com
 * Reads the password from the ADMIN_PASSWORD env var if set (for
 * scripted/Docker `exec` use), otherwise prompts interactively with
 * masked input.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** Matches apps/web/lib/password.ts's MIN_PASSWORD_LENGTH. */
const MIN_PASSWORD_LENGTH = 12;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Prompts without echoing the typed characters — a small, well-known
 * Node recipe (mute readline's own echo after the question text is
 * written) rather than pulling in a new dependency for one prompt.
 */
function promptHiddenPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const rlInternals = rl as unknown as { _writeToOutput: (text: string) => void };
    let muted = false;
    rlInternals._writeToOutput = (text: string) => {
      if (!muted) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run create-admin -w packages/db -- you@example.com");
    process.exitCode = 1;
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? (await promptHiddenPassword("New admin password: "));
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.appUser.upsert({
      where: { email },
      update: { passwordHash, role: "admin" },
      create: { email, passwordHash, role: "admin" },
    });
    console.log(`✔ Admin account ready: ${user.email} (id ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

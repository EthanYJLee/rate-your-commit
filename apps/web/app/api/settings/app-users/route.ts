import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";
import type { AppRole } from "../../../../lib/admin-role";
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../../../../lib/password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: AppRole[] = ["admin", "member"];

/**
 * Admin-provisions an email/password sign-in account (see auth.ts —
 * additive to GitHub OAuth). No public self-registration: this route
 * itself sits behind proxy.ts's blanket "must already be signed in"
 * check, same as every other /settings/* admin action.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";

  if (!EMAIL_PATTERN.test(email)) {
    return respondWithError(request, contentType, "올바른 이메일 형식이 아닙니다.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return respondWithError(
      request,
      contentType,
      `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return respondWithError(
      request,
      contentType,
      `비밀번호는 최대 ${MAX_PASSWORD_LENGTH}자까지 가능합니다.`
    );
  }

  // Defaults to "member" on any missing/invalid value — an admin must
  // explicitly opt a new account into "admin" via the form's select,
  // matching the secure-by-default posture confirmed for this feature
  // (only pre-existing rows were grandfathered to admin, by the
  // migration's backfill, not new ones).
  const role: AppRole = VALID_ROLES.includes(raw.role as AppRole) ? (raw.role as AppRole) : "member";

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.appUser.create({ data: { email, passwordHash, role } });

    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/settings/app-users", request.url), { status: 303 });
    }
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch {
    return respondWithError(request, contentType, "이미 존재하는 이메일입니다.");
  }
}

function respondWithError(request: NextRequest, contentType: string, message: string) {
  if (!contentType.includes("application/json")) {
    const url = new URL("/settings/app-users", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

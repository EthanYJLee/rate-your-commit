import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Revokes an email/password account. POST (not a REST DELETE verb) —
 * matches this codebase's other admin actions (merge/unmerge/split),
 * all plain-HTML-form-submittable with no client-side JS required.
 * Shipped alongside account creation deliberately — a credential
 * store you can grant access from but never revoke is its own
 * security gap, even though password-reset (a different concern) is
 * out of scope this round.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.appUser.delete({ where: { id } });
  } catch {
    // Already-deleted/unknown id (Prisma P2025) — fail into the same
    // "back to the list with a message" flow as every other admin
    // action here, not an unhandled 500.
    const url = new URL("/settings/app-users", request.url);
    url.searchParams.set("error", "이미 삭제되었거나 존재하지 않는 계정입니다.");
    return NextResponse.redirect(url, { status: 303 });
  }

  return NextResponse.redirect(new URL("/settings/app-users", request.url), { status: 303 });
}

import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Links (or clears, with an empty personId) an AppUser to a Person —
 * mirrors /api/people/[id]/team's exact pattern. Convenience only
 * (see AppUser.personId's schema doc comment), not an access grant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const personId = typeof raw.personId === "string" && raw.personId.length > 0 ? raw.personId : null;

  const updated = await prisma.appUser.update({ where: { id }, data: { personId } });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/settings/app-users", request.url), { status: 303 });
  }
  return NextResponse.json({ user: updated });
}

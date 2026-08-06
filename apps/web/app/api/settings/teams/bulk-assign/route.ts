import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

const FIELD_PREFIX = "team_";

/**
 * Batch version of /api/people/[id]/team: the /settings/teams page
 * puts every person's team <select> inside ONE form (each named
 * `team_{personId}`) with a single submit button, instead of one
 * form-per-row with its own save click — picked over the earlier
 * per-row pattern specifically so an admin can set several people's
 * teams independently, then save all of them in one action. Plain
 * form POST, no client JS, matching this codebase's other admin
 * routes.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const assignments = Object.entries(raw)
    .filter(([key, value]) => key.startsWith(FIELD_PREFIX) && typeof value === "string")
    .map(([key, value]) => ({
      personId: key.slice(FIELD_PREFIX.length),
      teamId: (value as string).length > 0 ? (value as string) : null,
    }));

  if (assignments.length > 0) {
    await prisma.$transaction(
      assignments.map(({ personId, teamId }) =>
        prisma.person.update({ where: { id: personId }, data: { teamId } })
      )
    );
  }

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/settings/teams", request.url), { status: 303 });
  }
  return NextResponse.json({ updated: assignments.length });
}

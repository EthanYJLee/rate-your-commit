import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Assigns (or clears, with an empty teamId) a Person's team. Plain
 * per-row form on /settings/teams, same dual JSON/form-POST support
 * as the rest of the admin routes.
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

  const teamId = typeof raw.teamId === "string" && raw.teamId.length > 0 ? raw.teamId : null;

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const updated = await prisma.person.update({ where: { id }, data: { teamId } });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/settings/teams", request.url), { status: 303 });
  }
  return NextResponse.json({ person: updated });
}

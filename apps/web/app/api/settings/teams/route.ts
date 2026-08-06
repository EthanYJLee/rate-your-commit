import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a Team (S-01's team-comparison chart needs at least one to
 * show anything besides the 미배정 bucket). No connector reports team
 * membership, so this — plus /api/people/[id]/team — is the only way
 * teams get populated.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    return respondWithError(request, contentType, "팀 이름을 입력하세요.");
  }

  try {
    const team = await prisma.team.create({ data: { name } });

    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/settings/teams", request.url), { status: 303 });
    }
    return NextResponse.json({ team });
  } catch {
    return respondWithError(request, contentType, "이미 존재하는 팀 이름입니다.");
  }
}

function respondWithError(request: NextRequest, contentType: string, message: string) {
  if (!contentType.includes("application/json")) {
    const url = new URL("/settings/teams", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

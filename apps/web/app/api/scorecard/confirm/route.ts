import { prisma } from "@rateyourcommit/db";
import { NextRequest, NextResponse } from "next/server";
import { getActorLogin } from "../../../../lib/audit-log";
import { parsePeriodParam, periodParam } from "../../../../lib/period-param";

/**
 * S-06's "확정" action — locks a period's ScoreResult rows in as the
 * compensation-grade snapshot for that period. See ScoreConfirmation's
 * schema doc comment for what existence of a row actually does
 * (blocks apps/worker from recomputing that period going forward).
 *
 * Deliberately fails CLOSED, matching the original 화면설계서 exactly:
 * ANY unresolved Identity anywhere in the org blocks confirmation of
 * ANY period, not just periods that unresolved identity's commits
 * fall within — a compensation decision shouldn't be finalized while
 * there's a known, unresolved data-quality gap in the org, full stop.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const period = parsePeriodParam(typeof raw.period === "string" ? raw.period : undefined);

  const unresolvedCount = await prisma.identity.count({ where: { personId: null } });
  if (unresolvedCount > 0) {
    return respondWithError(
      request,
      contentType,
      period,
      `미해결 아이덴티티가 ${unresolvedCount}개 있어 확정할 수 없습니다. /identities에서 먼저 해결하세요.`
    );
  }

  try {
    await prisma.scoreConfirmation.create({
      data: {
        periodStart: period.start,
        periodEnd: period.end,
        confirmedByLogin: await getActorLogin(),
      },
    });
  } catch {
    // Unique constraint on (periodStart, periodEnd) — already
    // confirmed. No unconfirm action exists yet (see schema doc
    // comment), so this is the only way create() can fail here.
    return respondWithError(request, contentType, period, "이미 확정된 기간입니다.");
  }

  if (!contentType.includes("application/json")) {
    const url = new URL("/scorecard", request.url);
    url.searchParams.set("period", periodParam(period));
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ confirmed: true });
}

function respondWithError(
  request: NextRequest,
  contentType: string,
  period: ReturnType<typeof parsePeriodParam>,
  message: string
) {
  if (!contentType.includes("application/json")) {
    const url = new URL("/scorecard", request.url);
    url.searchParams.set("period", periodParam(period));
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

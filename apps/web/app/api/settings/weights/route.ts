import { DEFAULT_ORGANIZATION_ID, prisma } from "@rateyourcommit/db";
import { InvalidWeightsError, calculateScore } from "@rateyourcommit/scoring";
import type { AxisWeights } from "@rateyourcommit/scoring";
import { NextRequest, NextResponse } from "next/server";

const AXES: (keyof AxisWeights)[] = ["delivery", "quality", "collaboration", "evaluation"];

/**
 * Creates a NEW ScoreWeightConfig row rather than updating the
 * current one in place — ScoreWeightConfig is versioned by
 * `effectiveFrom` (apps/worker always reads the most recent row), so
 * "saving" here means "a new version takes effect from now on",
 * preserving the history of what weights produced a past ScoreResult.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw: Record<string, unknown> = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  const weights = {} as AxisWeights;
  for (const axis of AXES) {
    const value = Number(raw[axis]);
    if (Number.isNaN(value)) {
      return respondWithError(request, contentType, `${axis} must be a number.`);
    }
    weights[axis] = value;
  }

  try {
    // Reuses calculateScore's own sum-to-100 validation instead of
    // duplicating that check — the metrics values here are
    // irrelevant, only the weights are being validated.
    calculateScore({ delivery: 0, quality: 0, collaboration: 0, evaluation: 0 }, weights);
  } catch (err) {
    if (err instanceof InvalidWeightsError) {
      return respondWithError(request, contentType, err.message);
    }
    throw err;
  }

  const config = await prisma.scoreWeightConfig.create({
    data: { organizationId: DEFAULT_ORGANIZATION_ID, ...weights },
  });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/settings/weights", request.url), { status: 303 });
  }
  return NextResponse.json({ config });
}

function respondWithError(request: NextRequest, contentType: string, message: string) {
  if (!contentType.includes("application/json")) {
    const url = new URL("/settings/weights", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

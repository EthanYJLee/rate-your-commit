import { prisma } from "@rateyourcommit/db";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import type { PeriodRange } from "@rateyourcommit/metrics";

/**
 * Every month that has at least one ScoreResult backed by REAL
 * activity (commitCount > 0 or ticketCount > 0 on some row), newest
 * first, plus the current month even if nothing's been scored for it
 * yet (so the picker always has a selectable "today" option, not just
 * history).
 *
 * apps/worker#computeAndPersistScoresForAllPeriods deliberately
 * backfills a ScoreResult for EVERY month from a project's earliest
 * commit through today, even months with zero real activity (that's
 * the "absence of activity isn't penalized" design — see
 * NO_ACTIVITY_DEFAULT's doc comment) — those empty rows are correct
 * to keep as a historical record, but listing all of them here would
 * make the period picker balloon with years of "nothing happened"
 * months for a project with a long gap in its history. Filtering to
 * real activity here is a display-only concern; it doesn't change
 * what the worker computes or stores.
 */
export async function listAvailablePeriods(): Promise<PeriodRange[]> {
  const rows = await prisma.scoreResult.findMany({
    where: { OR: [{ commitCount: { gt: 0 } }, { ticketCount: { gt: 0 } }] },
    distinct: ["periodStart"],
    select: { periodStart: true, periodEnd: true },
    orderBy: { periodStart: "desc" },
  });
  const periods = rows
    .filter((row): row is { periodStart: Date; periodEnd: Date } => row.periodStart instanceof Date)
    .map((row) => ({ start: row.periodStart, end: row.periodEnd }));

  const current = currentMonthPeriod();
  const hasCurrent = periods.some((p) => p.start.getTime() === current.start.getTime());
  return hasCurrent ? periods : [current, ...periods];
}

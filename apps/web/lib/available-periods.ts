import { prisma } from "@rateyourcommit/db";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import type { PeriodRange } from "@rateyourcommit/metrics";

/** Every month that has at least one ScoreResult, newest first, plus
 * the current month even if nothing's been scored for it yet (so the
 * picker always has a selectable "today" option, not just history). */
export async function listAvailablePeriods(): Promise<PeriodRange[]> {
  const rows = await prisma.scoreResult.findMany({
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

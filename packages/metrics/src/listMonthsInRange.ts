import type { PeriodRange } from "./types";

/**
 * Every calendar month from `earliest`'s month through `latest`'s
 * month, inclusive, oldest first — the set of periods
 * apps/worker#computeAndPersistScoresForAllPeriods backfills a
 * ScoreResult for. Pure UTC month-boundary math, same convention as
 * currentMonthPeriod (this package's other period function), so the
 * two can't drift apart on what a "month" means.
 *
 * `earliest` after `latest` returns an empty array rather than
 * throwing — the caller (an aggregate query with no matching rows)
 * degrades to "nothing to backfill", not a crash.
 */
export function listMonthsInRange(earliest: Date, latest: Date): PeriodRange[] {
  const periods: PeriodRange[] = [];

  let year = earliest.getUTCFullYear();
  let month = earliest.getUTCMonth();
  const lastYear = latest.getUTCFullYear();
  const lastMonth = latest.getUTCMonth();

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    periods.push({
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return periods;
}

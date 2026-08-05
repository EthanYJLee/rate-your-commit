import type { PeriodRange } from "./types";

/**
 * The current UTC calendar month as a [start, end) PeriodRange.
 * Shared by apps/worker (writes ScoreResult for this period) and
 * apps/web (reads it back) so the two sides can't drift apart on
 * what "this month" means. Accepts `now` for testability.
 */
export function currentMonthPeriod(now: Date = new Date()): PeriodRange {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

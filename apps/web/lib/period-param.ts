import { currentMonthPeriod } from "@rateyourcommit/metrics";
import type { PeriodRange } from "@rateyourcommit/metrics";

const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/;

/** Parses a "YYYY-MM" query param (e.g. "2026-08") into that month's
 * PeriodRange. Falls back to the current month for anything missing
 * or malformed — a bad/tampered query param should degrade to "today"
 * silently, not error the page. */
export function parsePeriodParam(raw: string | undefined): PeriodRange {
  const match = raw?.match(PERIOD_PATTERN);
  if (!match) return currentMonthPeriod();

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return currentMonthPeriod();

  return currentMonthPeriod(new Date(Date.UTC(year, month - 1, 1)));
}

/** The inverse of parsePeriodParam — for building <option value> and
 * link hrefs. */
export function periodParam(period: PeriodRange): string {
  const year = period.start.getUTCFullYear();
  const month = String(period.start.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function periodLabel(period: PeriodRange): string {
  return `${period.start.getUTCFullYear()}년 ${period.start.getUTCMonth() + 1}월`;
}

/** Just the month, no year — for an <option> nested under a
 * PeriodPicker <optgroup> that already names the year. */
export function periodMonthLabel(period: PeriodRange): string {
  return `${period.start.getUTCMonth() + 1}월`;
}

/**
 * Groups periods into a Map keyed by year, preserving each period's
 * relative order — feeds PeriodPicker's <optgroup> rendering, so a
 * long history (this app now backfills every month since a project's
 * first commit — see apps/worker#computeAndPersistScoresForAllPeriods)
 * reads as a year-by-year list instead of one giant flat dropdown.
 * Map iteration order follows insertion order, so as long as the
 * input is already newest-first (listAvailablePeriods orders by
 * periodStart desc), years come out newest-first too — no extra sort.
 */
export function groupPeriodsByYear(periods: PeriodRange[]): Map<number, PeriodRange[]> {
  const groups = new Map<number, PeriodRange[]>();
  for (const period of periods) {
    const year = period.start.getUTCFullYear();
    const existing = groups.get(year);
    if (existing) existing.push(period);
    else groups.set(year, [period]);
  }
  return groups;
}

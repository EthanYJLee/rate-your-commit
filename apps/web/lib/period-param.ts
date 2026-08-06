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

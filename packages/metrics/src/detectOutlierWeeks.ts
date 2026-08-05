import type { AuthorWeeklyStats, OutlierWeek } from "./types";

export const DEFAULT_OUTLIER_MULTIPLIER = 5;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Flags an author's weeks whose total line-change volume (additions +
 * deletions) exceeds `multiplier`x that same author's own median
 * active week — e.g. a vendored-dependency drop or a huge
 * auto-generated commit. Deliberately self-relative (each author
 * compared only to their own baseline, not project-wide) so
 * naturally prolific-but-consistent contributors aren't penalized.
 *
 * Pure function, no I/O — the exact math a manager could redo by hand
 * with a calculator, matching packages/scoring's explainability bar
 * (see docs/AI-POLICY.md).
 *
 * Input is GitHub's weekly aggregate stats (stats/contributors), not
 * per-commit stats, so a flagged week marks EVERY commit that author
 * made in that week, not one specific commit — see RawCommit.additions
 * in packages/connectors for why per-commit stats aren't fetched.
 */
export function detectOutlierWeeks(
  stats: AuthorWeeklyStats[],
  multiplier: number = DEFAULT_OUTLIER_MULTIPLIER
): OutlierWeek[] {
  const outliers: OutlierWeek[] = [];

  for (const author of stats) {
    const activeWeeks = author.weeks.filter((week) => week.commits > 0);
    const totals = activeWeeks.map((week) => week.additions + week.deletions);
    const baseline = median(totals);

    // Need at least two active weeks for "median week" to mean
    // anything, and a zero baseline can't be multiplied into a
    // meaningful threshold.
    if (activeWeeks.length < 2 || baseline === 0) continue;

    for (const week of activeWeeks) {
      const total = week.additions + week.deletions;
      if (total <= baseline * multiplier) continue;

      outliers.push({
        authorHandle: author.authorHandle,
        weekStart: week.weekStart,
        weekEnd: new Date(week.weekStart.getTime() + WEEK_MS),
        totalLines: total,
        medianLines: baseline,
        reason:
          `LOC outlier: ${total} lines changed in the week of ` +
          `${week.weekStart.toISOString().slice(0, 10)}, ${multiplier}x this ` +
          `author's own median week (${baseline}).`,
      });
    }
  }

  return outliers;
}

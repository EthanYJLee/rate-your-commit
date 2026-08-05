import type { AxisMetrics, CommitForMetrics, PeriodRange, TicketForMetrics } from "./types";

/**
 * Used whenever a period has zero of the relevant activity (no
 * commits for quality, no active tickets for delivery). Absence of
 * activity isn't evidence of a shortfall, so we don't penalize it —
 * that's a workload-allocation question for a manager, not a personal
 * quality/delivery failure. Documented here rather than silently
 * defaulting to 0, per the "explainable by hand" bar in
 * packages/scoring.
 */
export const NO_ACTIVITY_DEFAULT = 100;

/**
 * collaboration/evaluation have no real data source in MVP — no PR
 * review data is collected (collaboration) and peer evaluation (S-05)
 * is deferred to v2. Both are constant placeholders; pair with a 0
 * weight in ScoreWeightConfig so they don't actually affect the final
 * score until real data exists.
 */
export const UNIMPLEMENTED_AXIS_PLACEHOLDER = 100;

function isWithin(date: Date, period: PeriodRange): boolean {
  return date >= period.start && date < period.end;
}

function computeQuality(commits: CommitForMetrics[], period: PeriodRange): number {
  const periodCommits = commits.filter((commit) => isWithin(commit.authoredAt, period));
  if (periodCommits.length === 0) return NO_ACTIVITY_DEFAULT;

  const excluded = periodCommits.filter((commit) => commit.excludedFlag).length;
  return Math.round(((periodCommits.length - excluded) / periodCommits.length) * 1000) / 10;
}

function computeDelivery(tickets: TicketForMetrics[], period: PeriodRange): number {
  // "Active during the period": already existed before it ended, and
  // wasn't closed before it started (still on this person's plate at
  // some point in-period).
  const activeTickets = tickets.filter(
    (ticket) =>
      ticket.createdAt < period.end &&
      (ticket.closedAt === undefined || ticket.closedAt >= period.start)
  );
  if (activeTickets.length === 0) return NO_ACTIVITY_DEFAULT;

  const closedInPeriod = activeTickets.filter(
    (ticket) => ticket.closedAt !== undefined && isWithin(ticket.closedAt, period)
  ).length;
  return Math.round((closedInPeriod / activeTickets.length) * 1000) / 10;
}

/**
 * Turns one person's raw commits/tickets into the four 0-100 axis
 * metrics packages/scoring#calculateScore expects. Pure function, no
 * I/O — callers (apps/worker) are responsible for querying Prisma and
 * passing in already-fetched rows for this person across all of their
 * linked Identities.
 *
 * - quality: % of this period's commits NOT flagged as LOC outliers
 *   (S-04, packages/metrics#detectOutlierWeeks feeds Commit.excludedFlag).
 * - delivery: % of tickets "active" in this period that got closed
 *   within it (a completion rate, not a raw throughput count).
 * - collaboration / evaluation: not implemented in MVP (no PR-review
 *   data; peer evaluation is S-05, deferred to v2) — constant
 *   placeholder, meant to be paired with a 0 weight.
 */
export function computeAxisMetrics(
  commits: CommitForMetrics[],
  tickets: TicketForMetrics[],
  period: PeriodRange
): AxisMetrics {
  return {
    delivery: computeDelivery(tickets, period),
    quality: computeQuality(commits, period),
    collaboration: UNIMPLEMENTED_AXIS_PLACEHOLDER,
    evaluation: UNIMPLEMENTED_AXIS_PLACEHOLDER,
  };
}

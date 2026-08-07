/**
 * Local input shapes for this package's aggregation functions. Kept
 * independent of @rateyourcommit/connectors on purpose — this package
 * has no I/O and shouldn't depend on how the data was fetched, only
 * on its (structurally identical) shape. See docs/ARCHITECTURE.md §4:
 * the same "pure function, explainable, auditable" principle applied
 * to packages/scoring extends here.
 */
export type { AxisMetrics } from "@rateyourcommit/scoring";

/** The subset of Commit fields computeAxisMetrics' quality calc needs. */
export interface CommitForMetrics {
  authoredAt: Date;
  excludedFlag: boolean;
}

/** The subset of Ticket fields computeAxisMetrics' delivery calc needs. */
export interface TicketForMetrics {
  createdAt: Date;
  closedAt?: Date;
}

export interface PeriodRange {
  start: Date;
  /** Exclusive — matches the OutlierWeek.weekEnd convention below. */
  end: Date;
}

/** computeRawActivity's return shape — see its own doc comment. */
export interface RawActivity {
  commitCount: number;
  excludedCommitCount: number;
  ticketCount: number;
  closedTicketCount: number;
}

export interface WeeklyActivity {
  weekStart: Date;
  additions: number;
  deletions: number;
  commits: number;
}

export interface AuthorWeeklyStats {
  authorHandle: string;
  weeks: WeeklyActivity[];
}

export interface OutlierWeek {
  authorHandle: string;
  weekStart: Date;
  /** Exclusive end of the week window (weekStart + 7 days). */
  weekEnd: Date;
  totalLines: number;
  medianLines: number;
  reason: string;
}

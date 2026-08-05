/**
 * Common adapter interfaces every connector implements. Real
 * implementations (github/, gitlab/, jira/, linear/) land in v1.0 —
 * see docs/ARCHITECTURE.md §2 for priority order. Nothing in this
 * package touches packages/scoring directly; apps/worker is the only
 * consumer, and it writes normalized rows via packages/db.
 */

export interface RawIdentity {
  /** Provider-native login/username, e.g. GitHub login or GitLab username. */
  handle: string;
  /** Display name as it appears in commit authorship, if available. */
  displayName?: string;
  email?: string;
}

export interface RawCommit {
  sha: string;
  authorHandle: string;
  authorEmail?: string;
  message: string;
  /**
   * Line-change stats, when the connector can provide them cheaply.
   * The v1 GitHub connector omits these: GitHub's commit-list endpoint
   * doesn't include stats, and fetching them would cost one extra API
   * call per commit — infeasible at all-branches/full-history scale.
   * A future version can backfill this from GitHub's aggregate
   * `stats/contributors` endpoint instead. Consumers (e.g. S-04 outlier
   * detection) must treat a missing value as "unknown", not zero.
   */
  additions?: number;
  deletions?: number;
  authoredAt: Date;
}

export interface RawTicket {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  closedAt?: Date;
}

export interface SourceConnector {
  /** Stable identifier, e.g. "github" | "gitlab" | "bitbucket". */
  id: string;
  fetchAuthors(): Promise<RawIdentity[]>;
  fetchCommits(since: Date): Promise<RawCommit[]>;
}

export interface TrackerConnector {
  /** Stable identifier, e.g. "github-issues" | "jira" | "linear". */
  id: string;
  fetchTickets(since: Date): Promise<RawTicket[]>;
}

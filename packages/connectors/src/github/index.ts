import { Octokit } from "@octokit/rest";
import type { RawCommit, RawIdentity, SourceConnector } from "../types";

export class GitHubConnectorError extends Error {}

/**
 * Minimal Octokit surface this connector needs — lets tests inject a
 * fake client instead of pulling in a mocking library.
 */
export interface OctokitLike {
  paginate: <T>(fn: unknown, params: Record<string, unknown>) => Promise<T[]>;
  repos: {
    listBranches: unknown;
    listCommits: unknown;
    /**
     * Not paginated like the others — GitHub returns all contributors
     * in one response (or 202 while it computes the cache). Optional
     * so existing test fakes that predate S-04 don't need updating.
     */
    getContributorsStats?: (
      params: Record<string, unknown>
    ) => Promise<{ status: number; data?: unknown }>;
  };
}

export interface GitHubConnectorOptions {
  owner: string;
  repo: string;
  /** Personal access token. Ignored if `octokit` is provided. */
  token?: string;
  /** Injectable for tests; a real Octokit instance is created if omitted. */
  octokit?: OctokitLike;
}

interface GitHubBranch {
  name: string;
}

export interface ContributorWeek {
  weekStart: Date;
  additions: number;
  deletions: number;
  commits: number;
}

export interface ContributorWeeklyStats {
  authorHandle: string;
  weeks: ContributorWeek[];
}

export type ContributorStatsResult =
  | { status: "ready"; stats: ContributorWeeklyStats[] }
  | { status: "pending" };

interface RawContributorStat {
  author: { login: string } | null;
  weeks: { w: number; a: number; d: number; c: number }[];
}

interface GitHubCommitListItem {
  sha: string;
  author: { login?: string } | null;
  commit: {
    message: string;
    author: { name?: string; email?: string; date?: string } | null;
    committer: { date?: string } | null;
  };
}

/**
 * v1.0 GitHub source connector. Collects commits across ALL branches
 * and full history (per the approved v0.0.2 plan), deduplicated by
 * sha. Deliberately does not fetch per-commit line stats — see the
 * comment on RawCommit.additions in ../types.ts for why.
 *
 * Rate-limit handling is intentionally minimal: no auto-retry or
 * backoff. On failure this throws a clear GitHubConnectorError rather
 * than silently returning partial data.
 */
export class GitHubConnector implements SourceConnector {
  readonly id = "github";

  private readonly owner: string;
  private readonly repo: string;
  private readonly octokit: OctokitLike;

  constructor(options: GitHubConnectorOptions) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.octokit =
      options.octokit ??
      (new Octokit({ auth: options.token }) as unknown as OctokitLike);
  }

  async fetchAuthors(): Promise<RawIdentity[]> {
    const commits = await this.listAllCommits();
    const seen = new Map<string, RawIdentity>();

    for (const commit of commits) {
      const key = commit.authorEmail ?? commit.authorHandle;
      if (!seen.has(key)) {
        seen.set(key, {
          handle: commit.authorHandle,
          email: commit.authorEmail,
          displayName: commit.authorHandle,
        });
      }
    }

    return [...seen.values()];
  }

  async fetchCommits(since: Date): Promise<RawCommit[]> {
    return this.listAllCommits(since);
  }

  /**
   * Weekly per-author additions/deletions/commit counts for the whole
   * repo (GitHub's `stats/contributors`), used by S-04 outlier-week
   * detection (packages/metrics). One cached call instead of one API
   * call per commit — see RawCommit.additions for why per-commit
   * stats aren't fetched. Note per GitHub's docs: repos with 10,000+
   * commits get 0 for all addition/deletion counts.
   *
   * GitHub computes this asynchronously on first request and returns
   * 202 while the cache warms up (can take a few minutes on a large
   * repo). This connector does not poll/retry — callers should treat
   * `{ status: "pending" }` as "try again on the next scheduled sync".
   */
  async fetchContributorStats(): Promise<ContributorStatsResult> {
    if (!this.octokit.repos.getContributorsStats) {
      throw new GitHubConnectorError(
        "This Octokit client does not support getContributorsStats."
      );
    }

    let response: { status: number; data?: unknown };
    try {
      response = await this.octokit.repos.getContributorsStats({
        owner: this.owner,
        repo: this.repo,
      });
    } catch (err) {
      throw new GitHubConnectorError(
        `Failed to fetch contributor stats for ${this.owner}/${this.repo}. If this is a rate-limit ` +
          `error, wait for the reset window and re-run — this connector does not auto-retry (docs/ARCHITECTURE.md §2).`,
        { cause: err }
      );
    }

    if (response.status !== 200 || !response.data) {
      return { status: "pending" };
    }

    const stats = (response.data as RawContributorStat[])
      .filter((entry) => entry.author?.login)
      .map((entry) => ({
        authorHandle: entry.author!.login,
        weeks: entry.weeks.map((week) => ({
          weekStart: new Date(week.w * 1000),
          additions: week.a,
          deletions: week.d,
          commits: week.c,
        })),
      }));

    return { status: "ready", stats };
  }

  private async listBranches(): Promise<GitHubBranch[]> {
    try {
      return await this.octokit.paginate<GitHubBranch>(
        this.octokit.repos.listBranches,
        { owner: this.owner, repo: this.repo, per_page: 100 }
      );
    } catch (err) {
      throw new GitHubConnectorError(
        `Failed to list branches for ${this.owner}/${this.repo}. If this is a rate-limit error, ` +
          `wait for the reset window and re-run — this connector does not auto-retry (docs/ARCHITECTURE.md §2).`,
        { cause: err }
      );
    }
  }

  private async listAllCommits(since?: Date): Promise<RawCommit[]> {
    const branches = await this.listBranches();
    const bySha = new Map<string, RawCommit>();

    for (const branch of branches) {
      let commits: GitHubCommitListItem[];
      try {
        commits = await this.octokit.paginate<GitHubCommitListItem>(
          this.octokit.repos.listCommits,
          {
            owner: this.owner,
            repo: this.repo,
            sha: branch.name,
            per_page: 100,
            ...(since ? { since: since.toISOString() } : {}),
          }
        );
      } catch (err) {
        throw new GitHubConnectorError(
          `Failed to list commits on branch "${branch.name}" for ${this.owner}/${this.repo}. ` +
            `If this is a rate-limit error, wait for the reset window and re-run — this connector ` +
            `does not auto-retry (docs/ARCHITECTURE.md §2).`,
          { cause: err }
        );
      }

      for (const commit of commits) {
        if (bySha.has(commit.sha)) continue;
        bySha.set(commit.sha, {
          sha: commit.sha,
          authorHandle:
            commit.author?.login ?? commit.commit.author?.name ?? "unknown",
          authorEmail: commit.commit.author?.email,
          message: commit.commit.message,
          authoredAt: new Date(
            commit.commit.author?.date ??
              commit.commit.committer?.date ??
              Date.now()
          ),
        });
      }
    }

    return [...bySha.values()];
  }
}

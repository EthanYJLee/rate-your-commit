import { Octokit } from "@octokit/rest";
import type { RawTicket, TrackerConnector } from "../types";
import { GitHubConnectorError } from "./index";

/**
 * Minimal Octokit surface this connector needs — same DI approach as
 * GitHubConnector, so tests can inject a fake client instead of
 * pulling in a mocking library.
 */
export interface IssuesOctokitLike {
  paginate: <T>(fn: unknown, params: Record<string, unknown>) => Promise<T[]>;
  issues: {
    listForRepo: unknown;
  };
}

export interface GitHubIssuesConnectorOptions {
  owner: string;
  repo: string;
  /** Personal access token. Ignored if `octokit` is provided. */
  token?: string;
  /** Injectable for tests; a real Octokit instance is created if omitted. */
  octokit?: IssuesOctokitLike;
}

interface GitHubIssueListItem {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  /** Present (non-null) on pull requests; GitHub's issues endpoint returns both. */
  pull_request?: unknown;
}

/**
 * v1.0 GitHub tracker connector ("github-issues"). Collects plain
 * issues only — pull requests are deliberately excluded (they surface
 * via GitHub's issues API too, flagged by a `pull_request` field) so
 * PR activity doesn't get double-counted against a future
 * collaboration axis. `status` is passed through as GitHub's raw
 * "open"/"closed" state; no attempt is made to normalize this against
 * other trackers yet — see RawTicket.status in ../types.ts.
 *
 * Rate-limit handling matches GitHubConnector: no auto-retry, throws
 * a clear GitHubConnectorError on failure.
 */
export class GitHubIssuesConnector implements TrackerConnector {
  readonly id = "github-issues";

  private readonly owner: string;
  private readonly repo: string;
  private readonly octokit: IssuesOctokitLike;

  constructor(options: GitHubIssuesConnectorOptions) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.octokit =
      options.octokit ??
      (new Octokit({ auth: options.token }) as unknown as IssuesOctokitLike);
  }

  async fetchTickets(since: Date): Promise<RawTicket[]> {
    let issues: GitHubIssueListItem[];
    try {
      issues = await this.octokit.paginate<GitHubIssueListItem>(
        this.octokit.issues.listForRepo,
        {
          owner: this.owner,
          repo: this.repo,
          state: "all",
          since: since.toISOString(),
          per_page: 100,
        }
      );
    } catch (err) {
      throw new GitHubConnectorError(
        `Failed to list issues for ${this.owner}/${this.repo}. If this is a rate-limit error, ` +
          `wait for the reset window and re-run — this connector does not auto-retry (docs/ARCHITECTURE.md §2).`,
        { cause: err }
      );
    }

    return issues
      .filter((issue) => issue.pull_request === undefined)
      .map((issue) => ({
        id: String(issue.number),
        title: issue.title,
        status: issue.state,
        createdAt: new Date(issue.created_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
      }));
  }
}

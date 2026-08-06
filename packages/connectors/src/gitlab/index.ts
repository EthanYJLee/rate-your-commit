import type { RawCommit, RawIdentity, SourceConnector } from "../types";

export class GitLabConnectorError extends Error {}

const DEFAULT_BASE_URL = "https://gitlab.com";
const PER_PAGE = 100;

/**
 * Minimal HTTP seam this connector needs — lets tests inject a fake
 * client instead of pulling in a mocking library, same DI approach as
 * GitHubConnector's OctokitLike. No GitLab SDK dependency is added;
 * the real implementation (below) is a thin wrapper over native
 * `fetch`, since GitLab's REST API doesn't need anything heavier.
 */
export interface GitLabHttpClient {
  /**
   * GETs `path` (relative to the GitLab API base, e.g.
   * "/projects/123/repository/commits") with query params, returns
   * the parsed JSON response body.
   */
  get<T>(path: string, params: Record<string, string | number | boolean>): Promise<T>;
}

/** Exported so gitlab/issues.ts can build the same real client rather
 * than duplicating the fetch/auth-header logic. */
export class FetchGitLabHttpClient implements GitLabHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string
  ) {}

  async get<T>(path: string, params: Record<string, string | number | boolean>): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v4${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: this.token ? { "PRIVATE-TOKEN": this.token } : {},
    });

    if (!response.ok) {
      throw new Error(`GitLab API returned HTTP ${response.status} for ${url.pathname}`);
    }

    return (await response.json()) as T;
  }
}

export interface GitLabConnectorOptions {
  /**
   * GitLab project identifier as a path, e.g. "group/project" or
   * "group/subgroup/project" (GitLab supports nested groups, unlike
   * GitHub's flat owner/repo — so this is a single path, not a split
   * owner+repo pair).
   */
  projectPath: string;
  /** Personal access token. Ignored if `client` is provided. */
  token?: string;
  /** Defaults to gitlab.com; set for self-hosted instances. */
  baseUrl?: string;
  /** Injectable for tests; a real fetch-based client is created if omitted. */
  client?: GitLabHttpClient;
}

interface GitLabCommitListItem {
  id: string;
  author_name: string;
  author_email?: string;
  message: string;
  authored_date: string;
  stats?: { additions: number; deletions: number; total: number };
}

/**
 * v1.0 GitLab source connector. Unlike GitHubConnector, all-branches
 * history is one API call per page (`all=true` on the commits
 * endpoint ignores `ref_name` and returns commits across every ref),
 * not a per-branch loop — see docs/ARCHITECTURE.md §2. Commits are
 * still deduplicated by id defensively, since GitLab's docs don't
 * state whether `all=true` itself dedupes.
 *
 * Per-commit `additions`/`deletions` ARE populated here via
 * `with_stats=true` — a real difference from GitHubConnector, whose
 * RawCommit.additions doc comment explains why GitHub's commit-list
 * endpoint can't provide this cheaply. GitLab can, for free, on the
 * same request.
 *
 * `authorHandle` is the raw git `author_name`, not a resolved GitLab
 * account login — GitLab's commit objects carry no such field (only
 * `author_name`/`author_email`, decoupled from any GitLab account).
 *
 * Pagination stops on the first empty page rather than trusting
 * `x-total`/`x-total-pages` headers — GitLab's own docs say those are
 * omitted "for performance reasons" on large result sets, and
 * recommend either following the `Link` response header or falling
 * back to "response body is empty" as the stop signal. This connector
 * uses the latter (the `GitLabHttpClient` seam only returns parsed
 * JSON bodies, not headers, to keep it mockable without a fetch-mock
 * library) at the cost of one extra trailing request per sync.
 *
 * Rate-limit handling is intentionally minimal, matching
 * GitHubConnector: no auto-retry or backoff. On failure this throws a
 * clear GitLabConnectorError rather than silently returning partial
 * data.
 */
export class GitLabConnector implements SourceConnector {
  readonly id = "gitlab";

  private readonly projectPath: string;
  private readonly client: GitLabHttpClient;

  constructor(options: GitLabConnectorOptions) {
    this.projectPath = options.projectPath;
    this.client =
      options.client ??
      new FetchGitLabHttpClient(options.baseUrl ?? DEFAULT_BASE_URL, options.token);
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

  private async listAllCommits(since?: Date): Promise<RawCommit[]> {
    const path = `/projects/${encodeURIComponent(this.projectPath)}/repository/commits`;
    const bySha = new Map<string, RawCommit>();

    for (let page = 1; ; page += 1) {
      let items: GitLabCommitListItem[];
      try {
        items = await this.client.get<GitLabCommitListItem[]>(path, {
          all: true,
          with_stats: true,
          per_page: PER_PAGE,
          page,
          ...(since ? { since: since.toISOString() } : {}),
        });
      } catch (err) {
        throw new GitLabConnectorError(
          `Failed to list commits for ${this.projectPath}. If this is a rate-limit error, ` +
            `wait for the reset window and re-run — this connector does not auto-retry (docs/ARCHITECTURE.md §2).`,
          { cause: err }
        );
      }

      for (const item of items) {
        if (bySha.has(item.id)) continue;
        bySha.set(item.id, {
          sha: item.id,
          authorHandle: item.author_name,
          authorEmail: item.author_email,
          message: item.message,
          additions: item.stats?.additions,
          deletions: item.stats?.deletions,
          authoredAt: new Date(item.authored_date),
        });
      }

      if (items.length === 0) break;
    }

    return [...bySha.values()];
  }
}

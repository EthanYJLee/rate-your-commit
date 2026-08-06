import type { RawTicket, TrackerConnector } from "../types";
import { FetchGitLabHttpClient, GitLabConnectorError } from "./index";
import type { GitLabHttpClient } from "./index";

const DEFAULT_BASE_URL = "https://gitlab.com";
const PER_PAGE = 100;

export interface GitLabIssuesConnectorOptions {
  /** Same project-path identifier as GitLabConnector — see its doc comment. */
  projectPath: string;
  /** Personal access token. Ignored if `client` is provided. */
  token?: string;
  /** Defaults to gitlab.com; set for self-hosted instances. */
  baseUrl?: string;
  /** Injectable for tests; a real fetch-based client is created if omitted. */
  client?: GitLabHttpClient;
}

interface GitLabIssueListItem {
  iid: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  /**
   * The array form — GitLab's older singular `assignee` field still
   * exists on the API but is documented as deprecated in favor of
   * this one. Only the first assignee is used, matching
   * GitHubIssuesConnector's same "primary assignee only" choice for
   * multi-assignee trackers.
   */
  assignees: { username: string }[];
}

/**
 * v1.0 GitLab tracker connector ("gitlab-issues"). Same DI/error/
 * no-retry conventions as GitLabConnector — reuses its
 * GitLabHttpClient seam and FetchGitLabHttpClient implementation
 * rather than duplicating the fetch/auth-header logic, since both
 * connectors hit the same GitLab REST API.
 *
 * Verified against GitLab's issues API docs before implementing:
 * `state=all` returns both open and closed issues; `updated_after`
 * (ISO 8601, no JQL-style quoting quirks like Jira) is the `since`
 * filter; pagination has no documented total-count guarantee, so
 * (matching GitLabConnector's commits pagination) this stops on the
 * first empty page rather than trusting a page-size heuristic.
 *
 * Uses `iid` (the project-scoped number shown in GitLab's UI, e.g.
 * issue #42) as RawTicket.id — the human-facing identifier, same
 * choice GitHubIssuesConnector makes with `issue.number` — not the
 * globally-unique but not-user-facing `id`.
 *
 * `assigneeHandle` here is `assignees[0].username` — a genuine
 * resolved GitLab account username, unlike GitLabConnector's commit
 * `authorHandle` (which is only the git `author_name`, since commit
 * authorship isn't tied to a GitLab account). That means a person's
 * GitLab-commit identity and GitLab-issue identity can carry
 * different handle strings for the same project even though both
 * come from "gitlab" — the same identity fragmentation S-07's merge
 * screen already exists to resolve manually, not a new problem this
 * introduces (same reasoning apps/worker's resolveAssigneeIdentityId
 * doc comment already applies to GitHub).
 */
export class GitLabIssuesConnector implements TrackerConnector {
  readonly id = "gitlab-issues";

  private readonly projectPath: string;
  private readonly client: GitLabHttpClient;

  constructor(options: GitLabIssuesConnectorOptions) {
    this.projectPath = options.projectPath;
    this.client =
      options.client ??
      new FetchGitLabHttpClient(options.baseUrl ?? DEFAULT_BASE_URL, options.token);
  }

  async fetchTickets(since: Date): Promise<RawTicket[]> {
    const path = `/projects/${encodeURIComponent(this.projectPath)}/issues`;
    const byIid = new Map<string, RawTicket>();

    for (let page = 1; ; page += 1) {
      let items: GitLabIssueListItem[];
      try {
        items = await this.client.get<GitLabIssueListItem[]>(path, {
          state: "all",
          updated_after: since.toISOString(),
          per_page: PER_PAGE,
          page,
        });
      } catch (err) {
        throw new GitLabConnectorError(
          `Failed to list issues for ${this.projectPath}. If this is a rate-limit error, ` +
            `wait for the reset window and re-run — this connector does not auto-retry (docs/ARCHITECTURE.md §2).`,
          { cause: err }
        );
      }

      for (const item of items) {
        const id = String(item.iid);
        if (byIid.has(id)) continue;
        byIid.set(id, {
          id,
          title: item.title,
          status: item.state,
          createdAt: new Date(item.created_at),
          closedAt: item.closed_at ? new Date(item.closed_at) : undefined,
          assigneeHandle: item.assignees[0]?.username,
        });
      }

      if (items.length === 0) break;
    }

    return [...byIid.values()];
  }
}

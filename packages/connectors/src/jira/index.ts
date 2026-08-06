import type { RawTicket, TrackerConnector } from "../types";

export class JiraConnectorError extends Error {}

const PAGE_SIZE = 100;

/**
 * Minimal HTTP seam this connector needs — lets tests inject a fake
 * client instead of pulling in a mocking library, same DI approach as
 * GitHubConnector's OctokitLike / GitLabConnector's GitLabHttpClient.
 * POST (not GET) because Jira's own docs demonstrate the JQL/fields/
 * pagination-token payload as a JSON body, and this connector follows
 * that exact shape rather than guessing at GET query-param encoding
 * for array fields.
 */
export interface JiraHttpClient {
  post<T>(path: string, body: Record<string, unknown>): Promise<T>;
}

class FetchJiraHttpClient implements JiraHttpClient {
  private readonly authHeader: string;

  constructor(
    private readonly baseUrl: string,
    email?: string,
    apiToken?: string
  ) {
    this.authHeader =
      email && apiToken
        ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`
        : "";
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(this.authHeader ? { Authorization: this.authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Jira API returned HTTP ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }
}

export interface JiraConnectorOptions {
  /** Jira Cloud site base URL, e.g. "https://yoursite.atlassian.net". */
  baseUrl: string;
  /** Account email for Basic auth. Ignored if `client` is provided. */
  email?: string;
  /** Atlassian API token for Basic auth. Ignored if `client` is provided. */
  apiToken?: string;
  /** Project key, e.g. "OP" — scopes every JQL query this connector issues. */
  projectKey: string;
  /** Injectable for tests; a real fetch-based client is created if omitted. */
  client?: JiraHttpClient;
}

interface JiraIssueAssignee {
  accountId: string;
  displayName: string;
  /** Absent when the account's privacy settings hide it. */
  emailAddress?: string;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    created: string;
    resolutiondate: string | null;
    assignee: JiraIssueAssignee | null;
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  isLast: boolean;
  nextPageToken?: string;
}

/** yyyy-MM-dd HH:mm — JQL's date-literal format; anything else (including
 * full ISO 8601 with seconds/millis/timezone) is a syntax error. Formats
 * in UTC; Jira itself compares in the site's configured timezone, so this
 * is a best-effort filter, not an exact boundary — acceptable since every
 * caller in this codebase currently does full-history syncs anyway. */
function toJqlDate(date: Date): string {
  const iso = date.toISOString(); // "2026-01-15T10:30:00.000Z"
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * v1.0 Jira source-of-tickets connector ("jira"), Jira **Cloud** only —
 * Server/Data Center uses a materially different REST API (different
 * auth, and it never got the pagination migration below), deliberately
 * out of scope per docs/ARCHITECTURE.md §2's connector priority list.
 *
 * Uses `/rest/api/3/search/jql`, not the legacy `/rest/api/3/search` —
 * that endpoint has been fully removed by Atlassian. Pagination follows
 * its `nextPageToken`/`isLast` fields; there is no `total` count to
 * loop against (mirrors GitLabConnector's reasoning for stopping on an
 * explicit end signal rather than a page-size heuristic).
 *
 * A ticket counts as closed via Jira's project-agnostic status
 * category (`statusCategory.key === "done"`) rather than matching on
 * a status name, since workflow status names are custom per project.
 * `closedAt` comes from `resolutiondate`; if a "done"-category ticket
 * has no resolutiondate (an unusual workflow misconfiguration), this
 * is left undefined rather than guessed — same "absence over
 * invented data" convention as RawTicket.assigneeHandle elsewhere.
 *
 * `assigneeHandle` prefers `emailAddress`, falling back to
 * `displayName` then the always-present but opaque `accountId` —
 * Jira Cloud's privacy settings can hide an account's email.
 *
 * Rate-limit handling is intentionally minimal, matching the other
 * connectors: no auto-retry or backoff, throws a clear
 * JiraConnectorError on failure.
 */
export class JiraConnector implements TrackerConnector {
  readonly id = "jira";

  private readonly projectKey: string;
  private readonly client: JiraHttpClient;

  constructor(options: JiraConnectorOptions) {
    this.projectKey = options.projectKey;
    this.client =
      options.client ??
      new FetchJiraHttpClient(options.baseUrl, options.email, options.apiToken);
  }

  async fetchTickets(since: Date): Promise<RawTicket[]> {
    const jql = `project = "${this.projectKey}" and updated >= "${toJqlDate(since)}"`;
    const tickets: RawTicket[] = [];
    let nextPageToken: string | undefined;

    for (;;) {
      let page: JiraSearchResponse;
      try {
        page = await this.client.post<JiraSearchResponse>("/rest/api/3/search/jql", {
          jql,
          fields: ["summary", "status", "created", "resolutiondate", "assignee"],
          maxResults: PAGE_SIZE,
          ...(nextPageToken ? { nextPageToken } : {}),
        });
      } catch (err) {
        throw new JiraConnectorError(
          `Failed to search issues for project "${this.projectKey}". If this is a rate-limit ` +
            `error, wait for the reset window and re-run — this connector does not auto-retry ` +
            `(docs/ARCHITECTURE.md §2).`,
          { cause: err }
        );
      }

      tickets.push(...page.issues.map((issue) => this.toRawTicket(issue)));

      if (page.isLast) break;
      nextPageToken = page.nextPageToken;
    }

    return tickets;
  }

  private toRawTicket(issue: JiraIssue): RawTicket {
    const isDone = issue.fields.status.statusCategory.key === "done";
    const closedAt =
      isDone && issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : undefined;
    const assignee = issue.fields.assignee;

    return {
      id: issue.key,
      title: issue.fields.summary,
      status: issue.fields.status.name,
      createdAt: new Date(issue.fields.created),
      closedAt,
      assigneeHandle: assignee
        ? (assignee.emailAddress ?? assignee.displayName ?? assignee.accountId)
        : undefined,
    };
  }
}

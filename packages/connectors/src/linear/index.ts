import type { RawTicket, TrackerConnector } from "../types";

export class LinearConnectorError extends Error {}

const API_URL = "https://api.linear.app/graphql";
const PAGE_SIZE = 100;

const ISSUES_QUERY = `
  query Issues($teamKey: String!, $updatedSince: DateTimeOrDuration!, $after: String) {
    issues(
      first: ${PAGE_SIZE}
      after: $after
      filter: { team: { key: { eq: $teamKey } }, updatedAt: { gte: $updatedSince } }
    ) {
      nodes {
        identifier
        title
        state { name type }
        createdAt
        completedAt
        canceledAt
        assignee { email }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/**
 * Minimal GraphQL seam this connector needs — lets tests inject a
 * fake client instead of pulling in a mocking library, same DI
 * approach as the other connectors' HTTP seams. Linear's API is
 * GraphQL-only (no REST equivalent), so this wraps a single POST to
 * api.linear.app/graphql rather than modeling a generic REST `get`.
 */
export interface LinearGraphQLClient {
  query<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

class FetchLinearGraphQLClient implements LinearGraphQLClient {
  constructor(private readonly apiKey?: string) {}

  async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Personal API keys use the raw key, no "Bearer " prefix —
        // that prefix is OAuth-token-only per Linear's docs.
        ...(this.apiKey ? { Authorization: this.apiKey } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) {
      throw new Error(`Linear API returned errors: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    return body.data as T;
  }
}

export interface LinearConnectorOptions {
  /** Team's short key, e.g. "ENG" — scopes every query this connector issues. */
  teamKey: string;
  /** Personal API key. Ignored if `client` is provided. */
  apiKey?: string;
  /** Injectable for tests; a real fetch-based client is created if omitted. */
  client?: LinearGraphQLClient;
}

interface LinearIssueNode {
  identifier: string;
  title: string;
  state: { name: string; type: string };
  createdAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  assignee: { email: string } | null;
}

interface IssuesQueryResult {
  issues: {
    nodes: LinearIssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

/**
 * v1.0 Linear tracker connector ("linear"). Linear's API is GraphQL
 * only, authenticated via `Authorization: <API_KEY>` (no Bearer
 * prefix — that's OAuth-only, per Linear's docs), paginated
 * Relay-style (`pageInfo.hasNextPage`/`endCursor`, an `after` cursor
 * argument) — verified against Linear's own published schema
 * (github.com/linear/linear, packages/sdk/src/schema.graphql) before
 * implementing, same as the GitLab/Jira connectors' API verification.
 *
 * A ticket is "closed" via `completedAt ?? canceledAt` — Linear
 * tracks these as two distinct timestamps (`WorkflowState.type` is
 * one of triage/backlog/unstarted/started/completed/canceled/
 * duplicate), but RawTicket only has a single open/closed boundary,
 * so both terminal states count, matching how GitHub's `closed_at`
 * doesn't distinguish "completed" from "closed as not planned" and
 * Jira's `statusCategory.key === "done"` doesn't distinguish
 * Done/Won't-Do either.
 *
 * `assigneeHandle` is always the assignee's email — Linear's `User`
 * type has `email: String!` (non-nullable), unlike Jira's privacy-
 * hideable `emailAddress`, so no fallback chain is needed here.
 *
 * Rate-limit handling is intentionally minimal, matching the other
 * connectors: no auto-retry or backoff, throws a clear
 * LinearConnectorError on failure.
 */
export class LinearConnector implements TrackerConnector {
  readonly id = "linear";

  private readonly teamKey: string;
  private readonly client: LinearGraphQLClient;

  constructor(options: LinearConnectorOptions) {
    this.teamKey = options.teamKey;
    this.client = options.client ?? new FetchLinearGraphQLClient(options.apiKey);
  }

  async fetchTickets(since: Date): Promise<RawTicket[]> {
    const tickets: RawTicket[] = [];
    let after: string | undefined;

    for (;;) {
      let result: IssuesQueryResult;
      try {
        result = await this.client.query<IssuesQueryResult>(ISSUES_QUERY, {
          teamKey: this.teamKey,
          updatedSince: since.toISOString(),
          ...(after ? { after } : {}),
        });
      } catch (err) {
        throw new LinearConnectorError(
          `Failed to fetch issues for team "${this.teamKey}". If this is a rate-limit error, ` +
            `wait for the reset window and re-run — this connector does not auto-retry ` +
            `(docs/ARCHITECTURE.md §2).`,
          { cause: err }
        );
      }

      tickets.push(...result.issues.nodes.map((node) => this.toRawTicket(node)));

      if (!result.issues.pageInfo.hasNextPage) break;
      after = result.issues.pageInfo.endCursor ?? undefined;
    }

    return tickets;
  }

  private toRawTicket(node: LinearIssueNode): RawTicket {
    const closedAtSource = node.completedAt ?? node.canceledAt;

    return {
      id: node.identifier,
      title: node.title,
      status: node.state.name,
      createdAt: new Date(node.createdAt),
      closedAt: closedAtSource ? new Date(closedAtSource) : undefined,
      assigneeHandle: node.assignee?.email,
    };
  }
}

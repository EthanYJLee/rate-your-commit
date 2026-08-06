import { describe, expect, it } from "vitest";
import { GitLabIssuesConnector } from "../src/gitlab/issues";
import { GitLabConnectorError } from "../src/gitlab";
import type { GitLabHttpClient } from "../src/gitlab";

const OPEN_ISSUE = {
  iid: 1,
  title: "Fix login bug",
  state: "opened",
  created_at: "2026-01-01T00:00:00.000Z",
  closed_at: null,
  assignees: [{ id: 10, username: "alice", name: "Alice" }],
};

const CLOSED_ISSUE = {
  iid: 2,
  title: "Ship feature",
  state: "closed",
  created_at: "2026-01-02T00:00:00.000Z",
  closed_at: "2026-01-05T00:00:00.000Z",
  assignees: [{ id: 11, username: "bob", name: "Bob" }],
};

const UNASSIGNED_ISSUE = {
  iid: 3,
  title: "Nobody owns this",
  state: "opened",
  created_at: "2026-01-03T00:00:00.000Z",
  closed_at: null,
  assignees: [],
};

function fakeClient(pages: unknown[][]): GitLabHttpClient {
  return {
    get: async (path, params) => {
      if (!path.endsWith("/issues")) {
        throw new Error(`unexpected path passed to get: ${path}`);
      }
      const page = Number(params.page ?? 1);
      return (pages[page - 1] ?? []) as never;
    },
  };
}

describe("GitLabIssuesConnector.fetchTickets", () => {
  it("collects issues across all pages until an empty page, deduplicated by iid", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: fakeClient([[OPEN_ISSUE], [CLOSED_ISSUE], []]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets.map((t) => t.id).sort()).toEqual(["1", "2"]);
  });

  it("maps title, status, createdAt, and leaves closedAt undefined for an open issue", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: fakeClient([[OPEN_ISSUE], [], []]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0]).toMatchObject({ id: "1", title: "Fix login bug", status: "opened" });
    expect(tickets[0].createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(tickets[0].closedAt).toBeUndefined();
  });

  it("sets closedAt from closed_at for a closed issue", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: fakeClient([[CLOSED_ISSUE], [], []]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].closedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
  });

  it("uses the first assignee's username (not the deprecated singular `assignee` field)", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: fakeClient([[CLOSED_ISSUE], [], []]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].assigneeHandle).toBe("bob");
  });

  it("leaves assigneeHandle undefined when assignees is empty", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: fakeClient([[UNASSIGNED_ISSUE], [], []]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].assigneeHandle).toBeUndefined();
  });

  it("requests state=all and passes `since` as updated_after in ISO 8601", async () => {
    const seenParams: Record<string, unknown>[] = [];
    const client: GitLabHttpClient = {
      get: async (_path, params) => {
        seenParams.push(params);
        return (seenParams.length === 1 ? [OPEN_ISSUE] : []) as never;
      },
    };
    const connector = new GitLabIssuesConnector({ projectPath: "acme/widgets", client });

    await connector.fetchTickets(new Date("2020-01-01T00:00:00.000Z"));

    expect(seenParams[0]).toMatchObject({
      state: "all",
      updated_after: "2020-01-01T00:00:00.000Z",
    });
  });

  it("URL-encodes the project path in the request path", async () => {
    const seenPaths: string[] = [];
    const client: GitLabHttpClient = {
      get: async (path) => {
        seenPaths.push(path);
        return [] as never;
      },
    };
    const connector = new GitLabIssuesConnector({ projectPath: "group/subgroup/project", client });

    await connector.fetchTickets(new Date(0));

    expect(seenPaths[0]).toBe(
      `/projects/${encodeURIComponent("group/subgroup/project")}/issues`
    );
  });

  it("throws GitLabConnectorError with a clear message when the API call fails", async () => {
    const failingClient: GitLabHttpClient = {
      get: async () => {
        throw new Error("HTTP 403: rate limit exceeded");
      },
    };
    const connector = new GitLabIssuesConnector({
      projectPath: "acme/widgets",
      client: failingClient,
    });

    await expect(connector.fetchTickets(new Date(0))).rejects.toThrow(GitLabConnectorError);
  });
});

import { describe, expect, it } from "vitest";
import { JiraConnector, JiraConnectorError } from "../src/jira";
import type { JiraHttpClient } from "../src/jira";

function issue(overrides: {
  key: string;
  summary: string;
  statusName: string;
  statusCategoryKey: string;
  created: string;
  resolutiondate?: string;
  assignee?: { accountId: string; displayName: string; emailAddress?: string } | null;
}) {
  return {
    key: overrides.key,
    fields: {
      summary: overrides.summary,
      status: {
        name: overrides.statusName,
        statusCategory: { key: overrides.statusCategoryKey },
      },
      created: overrides.created,
      resolutiondate: overrides.resolutiondate ?? null,
      assignee: overrides.assignee ?? null,
    },
  };
}

const OPEN_TICKET = issue({
  key: "OP-1",
  summary: "Fix login bug",
  statusName: "In Progress",
  statusCategoryKey: "indeterminate",
  created: "2026-01-01T00:00:00.000+0000",
  assignee: { accountId: "acc-alice", displayName: "Alice", emailAddress: "alice@example.com" },
});

const DONE_TICKET = issue({
  key: "OP-2",
  summary: "Ship feature",
  statusName: "Done",
  statusCategoryKey: "done",
  created: "2026-01-02T00:00:00.000+0000",
  resolutiondate: "2026-01-05T00:00:00.000+0000",
  assignee: { accountId: "acc-bob", displayName: "Bob", emailAddress: "bob@example.com" },
});

function fakeClient(pages: unknown[][]): JiraHttpClient {
  let call = 0;
  return {
    post: async (path) => {
      if (path !== "/rest/api/3/search/jql") {
        throw new Error(`unexpected path passed to post: ${path}`);
      }
      const issues = pages[call] ?? [];
      const isLast = call >= pages.length - 1;
      call += 1;
      return { issues, isLast, nextPageToken: isLast ? undefined : "next-token" } as never;
    },
  };
}

describe("JiraConnector.fetchTickets", () => {
  it("maps id, title, status, createdAt from an open ticket with no assignee/resolution", async () => {
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[OPEN_TICKET]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      id: "OP-1",
      title: "Fix login bug",
      status: "In Progress",
    });
    expect(tickets[0].closedAt).toBeUndefined();
  });

  it("sets closedAt from resolutiondate only when statusCategory is 'done'", async () => {
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[DONE_TICKET]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].closedAt).toEqual(new Date("2026-01-05T00:00:00.000+0000"));
  });

  it("leaves closedAt undefined for a 'done'-category ticket with no resolutiondate", async () => {
    const doneNoResolution = issue({
      key: "OP-3",
      summary: "Weird workflow",
      statusName: "Closed",
      statusCategoryKey: "done",
      created: "2026-01-01T00:00:00.000+0000",
    });
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[doneNoResolution]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].closedAt).toBeUndefined();
  });

  it("prefers assignee emailAddress, falls back to displayName then accountId", async () => {
    const noEmail = issue({
      key: "OP-4",
      summary: "Privacy-locked assignee",
      statusName: "To Do",
      statusCategoryKey: "new",
      created: "2026-01-01T00:00:00.000+0000",
      assignee: { accountId: "acc-carol", displayName: "Carol" },
    });
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[OPEN_TICKET, noEmail]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets.find((t) => t.id === "OP-1")!.assigneeHandle).toBe("alice@example.com");
    expect(tickets.find((t) => t.id === "OP-4")!.assigneeHandle).toBe("Carol");
  });

  it("leaves assigneeHandle undefined for an unassigned ticket", async () => {
    const unassigned = issue({
      key: "OP-5",
      summary: "Nobody owns this",
      statusName: "To Do",
      statusCategoryKey: "new",
      created: "2026-01-01T00:00:00.000+0000",
      assignee: null,
    });
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[unassigned]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].assigneeHandle).toBeUndefined();
  });

  it("pages via nextPageToken until isLast is true", async () => {
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: fakeClient([[OPEN_TICKET], [DONE_TICKET]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets.map((t) => t.id).sort()).toEqual(["OP-1", "OP-2"]);
  });

  it("scopes the JQL to the configured project and formats `since` as a quoted JQL date", async () => {
    const seenBodies: Record<string, unknown>[] = [];
    const client: JiraHttpClient = {
      post: async (_path, body) => {
        seenBodies.push(body);
        return { issues: [], isLast: true } as never;
      },
    };
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client,
    });

    await connector.fetchTickets(new Date("2026-01-15T10:30:00.000Z"));

    expect(seenBodies[0].jql).toBe('project = "OP" and updated >= "2026-01-15 10:30"');
  });

  it("formats the epoch (full-history sync) the same way as any other `since` date", async () => {
    const seenBodies: Record<string, unknown>[] = [];
    const client: JiraHttpClient = {
      post: async (_path, body) => {
        seenBodies.push(body);
        return { issues: [], isLast: true } as never;
      },
    };
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client,
    });

    await connector.fetchTickets(new Date(0));

    expect(seenBodies[0].jql).toBe('project = "OP" and updated >= "1970-01-01 00:00"');
  });

  it("throws JiraConnectorError with a clear message when the API call fails", async () => {
    const failingClient: JiraHttpClient = {
      post: async () => {
        throw new Error("HTTP 401: unauthorized");
      },
    };
    const connector = new JiraConnector({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "OP",
      client: failingClient,
    });

    await expect(connector.fetchTickets(new Date(0))).rejects.toThrow(JiraConnectorError);
  });
});

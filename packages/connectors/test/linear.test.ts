import { describe, expect, it } from "vitest";
import { LinearConnector, LinearConnectorError } from "../src/linear";
import type { LinearGraphQLClient } from "../src/linear";

function node(overrides: {
  identifier: string;
  title: string;
  stateName: string;
  stateType: string;
  createdAt: string;
  completedAt?: string;
  canceledAt?: string;
  assignee?: { email: string } | null;
}) {
  return {
    identifier: overrides.identifier,
    title: overrides.title,
    state: { name: overrides.stateName, type: overrides.stateType },
    createdAt: overrides.createdAt,
    completedAt: overrides.completedAt ?? null,
    canceledAt: overrides.canceledAt ?? null,
    assignee: overrides.assignee ?? null,
  };
}

const OPEN_ISSUE = node({
  identifier: "ENG-1",
  title: "Fix login bug",
  stateName: "In Progress",
  stateType: "started",
  createdAt: "2026-01-01T00:00:00.000Z",
  assignee: { email: "alice@example.com" },
});

const COMPLETED_ISSUE = node({
  identifier: "ENG-2",
  title: "Ship feature",
  stateName: "Done",
  stateType: "completed",
  createdAt: "2026-01-02T00:00:00.000Z",
  completedAt: "2026-01-05T00:00:00.000Z",
  assignee: { email: "bob@example.com" },
});

const CANCELED_ISSUE = node({
  identifier: "ENG-3",
  title: "Abandoned idea",
  stateName: "Canceled",
  stateType: "canceled",
  createdAt: "2026-01-02T00:00:00.000Z",
  canceledAt: "2026-01-06T00:00:00.000Z",
});

function fakeClient(pages: unknown[][]): LinearGraphQLClient {
  let call = 0;
  return {
    query: async () => {
      const nodes = pages[call] ?? [];
      const hasNextPage = call < pages.length - 1;
      call += 1;
      return {
        issues: {
          nodes,
          pageInfo: { hasNextPage, endCursor: hasNextPage ? "next-cursor" : null },
        },
      } as never;
    },
  };
}

describe("LinearConnector.fetchTickets", () => {
  it("maps id (identifier), title, status from an open issue", async () => {
    const connector = new LinearConnector({
      teamKey: "ENG",
      client: fakeClient([[OPEN_ISSUE]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({ id: "ENG-1", title: "Fix login bug", status: "In Progress" });
    expect(tickets[0].closedAt).toBeUndefined();
  });

  it("sets closedAt from completedAt for a completed issue", async () => {
    const connector = new LinearConnector({
      teamKey: "ENG",
      client: fakeClient([[COMPLETED_ISSUE]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].closedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
  });

  it("sets closedAt from canceledAt for a canceled issue (also 'closed', per RawTicket's open/closed binary)", async () => {
    const connector = new LinearConnector({
      teamKey: "ENG",
      client: fakeClient([[CANCELED_ISSUE]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].closedAt).toEqual(new Date("2026-01-06T00:00:00.000Z"));
    expect(tickets[0].assigneeHandle).toBeUndefined();
  });

  it("uses the assignee's email directly as assigneeHandle (non-nullable in Linear's schema, no fallback needed)", async () => {
    const connector = new LinearConnector({
      teamKey: "ENG",
      client: fakeClient([[COMPLETED_ISSUE]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets[0].assigneeHandle).toBe("bob@example.com");
  });

  it("pages via pageInfo.hasNextPage/endCursor until the last page", async () => {
    const connector = new LinearConnector({
      teamKey: "ENG",
      client: fakeClient([[OPEN_ISSUE], [COMPLETED_ISSUE]]),
    });

    const tickets = await connector.fetchTickets(new Date(0));
    expect(tickets.map((t) => t.id).sort()).toEqual(["ENG-1", "ENG-2"]);
  });

  it("scopes the query to the configured team key and passes `since` as an updatedAt >= filter", async () => {
    const seenVariables: Record<string, unknown>[] = [];
    const client: LinearGraphQLClient = {
      query: async (_query, variables) => {
        seenVariables.push(variables);
        return {
          issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        } as never;
      },
    };
    const connector = new LinearConnector({ teamKey: "ENG", client });

    await connector.fetchTickets(new Date("2026-01-15T10:30:00.000Z"));

    expect(seenVariables[0]).toMatchObject({
      teamKey: "ENG",
      updatedSince: "2026-01-15T10:30:00.000Z",
    });
  });

  it("throws LinearConnectorError with a clear message when the API call fails", async () => {
    const failingClient: LinearGraphQLClient = {
      query: async () => {
        throw new Error("HTTP 401: unauthorized");
      },
    };
    const connector = new LinearConnector({ teamKey: "ENG", client: failingClient });

    await expect(connector.fetchTickets(new Date(0))).rejects.toThrow(LinearConnectorError);
  });
});

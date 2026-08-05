import { describe, expect, it } from "vitest";
import { GitHubConnectorError } from "../src/github";
import { GitHubIssuesConnector } from "../src/github/issues";
import type { IssuesOctokitLike } from "../src/github/issues";

const ISSUES_AND_PRS = [
  {
    number: 1,
    title: "Fix identity dedup bug",
    state: "closed",
    created_at: "2026-01-01T00:00:00Z",
    closed_at: "2026-01-05T00:00:00Z",
  },
  {
    number: 2,
    title: "Add GitLab connector",
    state: "open",
    created_at: "2026-01-02T00:00:00Z",
    closed_at: null,
  },
  // A pull request — GitHub's issues endpoint returns these too,
  // flagged by a non-null pull_request field. Must be excluded.
  {
    number: 3,
    title: "chore: bump deps",
    state: "closed",
    created_at: "2026-01-03T00:00:00Z",
    closed_at: "2026-01-03T01:00:00Z",
    pull_request: { url: "https://api.github.com/repos/acme/widgets/pulls/3" },
  },
];

function fakeOctokit(items = ISSUES_AND_PRS): IssuesOctokitLike {
  return {
    issues: { listForRepo: "listForRepo" },
    paginate: async () => items as never,
  };
}

describe("GitHubIssuesConnector.fetchTickets", () => {
  it("maps issues to RawTicket, excluding pull requests", async () => {
    const connector = new GitHubIssuesConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const tickets = await connector.fetchTickets(new Date("2020-01-01"));

    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.id).sort()).toEqual(["1", "2"]);
  });

  it("passes GitHub's raw open/closed state through as status", async () => {
    const connector = new GitHubIssuesConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const tickets = await connector.fetchTickets(new Date("2020-01-01"));
    const closed = tickets.find((t) => t.id === "1");
    const open = tickets.find((t) => t.id === "2");

    expect(closed?.status).toBe("closed");
    expect(closed?.closedAt).toEqual(new Date("2026-01-05T00:00:00Z"));
    expect(open?.status).toBe("open");
    expect(open?.closedAt).toBeUndefined();
  });

  it("throws GitHubConnectorError with a clear message when the API call fails", async () => {
    const failingOctokit: IssuesOctokitLike = {
      issues: { listForRepo: "listForRepo" },
      paginate: async () => {
        throw new Error("HTTP 403: rate limit exceeded");
      },
    };

    const connector = new GitHubIssuesConnector({
      owner: "acme",
      repo: "widgets",
      octokit: failingOctokit,
    });

    await expect(connector.fetchTickets(new Date("2020-01-01"))).rejects.toThrow(
      GitHubConnectorError
    );
  });
});

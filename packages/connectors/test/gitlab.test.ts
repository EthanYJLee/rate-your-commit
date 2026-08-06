import { describe, expect, it } from "vitest";
import { GitLabConnector, GitLabConnectorError } from "../src/gitlab";
import type { GitLabHttpClient } from "../src/gitlab";

const PAGE_1 = [
  {
    id: "aaa",
    author_name: "Alice",
    author_email: "alice@example.com",
    message: "init",
    authored_date: "2026-01-01T00:00:00Z",
    stats: { additions: 10, deletions: 2, total: 12 },
  },
  {
    id: "bbb",
    author_name: "Alice",
    author_email: "alice@example.com",
    message: "second commit",
    authored_date: "2026-01-02T00:00:00Z",
    stats: { additions: 3, deletions: 1, total: 4 },
  },
];

// Same commit repeated across pages — GitLab's `all=true` dedup behavior
// isn't documented, so the connector must defend against it anyway.
const PAGE_2 = [
  PAGE_1[0],
  {
    id: "ccc",
    author_name: "Bob",
    author_email: "bob@example.com",
    message: "feature work",
    authored_date: "2026-01-03T00:00:00Z",
    stats: { additions: 5, deletions: 0, total: 5 },
  },
];

function fakeClient(pages: unknown[][]): GitLabHttpClient {
  return {
    get: async (path, params) => {
      if (!path.endsWith("/repository/commits")) {
        throw new Error(`unexpected path passed to get: ${path}`);
      }
      const page = Number(params.page ?? 1);
      return (pages[page - 1] ?? []) as never;
    },
  };
}

describe("GitLabConnector.fetchCommits", () => {
  it("collects commits across all pages, deduplicated by id", async () => {
    const connector = new GitLabConnector({
      projectPath: "acme/widgets",
      client: fakeClient([PAGE_1, PAGE_2, []]),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));

    expect(commits).toHaveLength(3);
    expect(commits.map((c) => c.sha).sort()).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("populates additions/deletions from with_stats (unlike the GitHub connector)", async () => {
    const connector = new GitLabConnector({
      projectPath: "acme/widgets",
      client: fakeClient([PAGE_1, [], []]),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    const bbb = commits.find((c) => c.sha === "bbb");

    expect(bbb).toMatchObject({ additions: 3, deletions: 1 });
  });

  it("maps author handle (git author_name, not a resolved GitLab login), email, message, and authoredAt", async () => {
    const connector = new GitLabConnector({
      projectPath: "acme/widgets",
      client: fakeClient([PAGE_1, PAGE_2, []]),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    const bob = commits.find((c) => c.sha === "ccc");

    expect(bob).toMatchObject({
      authorHandle: "Bob",
      authorEmail: "bob@example.com",
      message: "feature work",
    });
    expect(bob!.authoredAt).toEqual(new Date("2026-01-03T00:00:00Z"));
  });

  it("passes `since` through as an ISO date string, and always requests all-branches + stats", async () => {
    const seenParams: Record<string, unknown>[] = [];
    const client: GitLabHttpClient = {
      get: async (_path, params) => {
        seenParams.push(params);
        return (seenParams.length === 1 ? PAGE_1 : []) as never;
      },
    };
    const connector = new GitLabConnector({ projectPath: "acme/widgets", client });

    await connector.fetchCommits(new Date("2020-01-01T00:00:00Z"));

    expect(seenParams[0]).toMatchObject({
      all: true,
      with_stats: true,
      since: "2020-01-01T00:00:00.000Z",
    });
  });

  it("throws GitLabConnectorError with a clear message when the API call fails", async () => {
    const failingClient: GitLabHttpClient = {
      get: async () => {
        throw new Error("HTTP 403: rate limit exceeded");
      },
    };

    const connector = new GitLabConnector({
      projectPath: "acme/widgets",
      client: failingClient,
    });

    await expect(connector.fetchCommits(new Date("2020-01-01"))).rejects.toThrow(
      GitLabConnectorError
    );
  });
});

describe("GitLabConnector.fetchAuthors", () => {
  it("returns unique identities keyed by email", async () => {
    const connector = new GitLabConnector({
      projectPath: "acme/widgets",
      client: fakeClient([PAGE_1, PAGE_2, []]),
    });

    const authors = await connector.fetchAuthors();

    expect(authors).toHaveLength(2);
    expect(authors.map((a) => a.email).sort()).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });
});

describe("GitLabConnector project path encoding", () => {
  it("URL-encodes a nested-group project path in the request path", async () => {
    const seenPaths: string[] = [];
    const client: GitLabHttpClient = {
      get: async (path) => {
        seenPaths.push(path);
        return [] as never;
      },
    };
    const connector = new GitLabConnector({
      projectPath: "group/subgroup/project",
      client,
    });

    await connector.fetchCommits(new Date("2020-01-01"));

    expect(seenPaths[0]).toBe(
      `/projects/${encodeURIComponent("group/subgroup/project")}/repository/commits`
    );
  });
});

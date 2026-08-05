import { describe, expect, it } from "vitest";
import { GitHubConnector, GitHubConnectorError } from "../src/github";
import type { OctokitLike } from "../src/github";

const BRANCHES = [{ name: "main" }, { name: "feature/x" }];

const MAIN_COMMITS = [
  {
    sha: "aaa",
    author: { login: "alice" },
    commit: {
      message: "init",
      author: { name: "Alice", email: "alice@example.com", date: "2026-01-01T00:00:00Z" },
      committer: { date: "2026-01-01T00:00:00Z" },
    },
  },
  {
    sha: "bbb",
    author: { login: "alice" },
    commit: {
      message: "second commit",
      author: { name: "Alice", email: "alice@example.com", date: "2026-01-02T00:00:00Z" },
      committer: { date: "2026-01-02T00:00:00Z" },
    },
  },
];

// "aaa" also appears on feature/x — shared history that must be deduped.
const FEATURE_COMMITS = [
  MAIN_COMMITS[0],
  {
    sha: "ccc",
    author: { login: "bob" },
    commit: {
      message: "feature work",
      author: { name: "Bob", email: "bob@example.com", date: "2026-01-03T00:00:00Z" },
      committer: { date: "2026-01-03T00:00:00Z" },
    },
  },
];

function fakeOctokit(): OctokitLike {
  return {
    repos: {
      listBranches: "listBranches-marker",
      listCommits: "listCommits-marker",
    },
    paginate: async (fn: unknown, params: Record<string, unknown>) => {
      if (fn === "listBranches-marker") {
        return BRANCHES as never;
      }
      if (fn === "listCommits-marker") {
        return (params.sha === "main" ? MAIN_COMMITS : FEATURE_COMMITS) as never;
      }
      throw new Error(`unexpected fn passed to paginate: ${String(fn)}`);
    },
  };
}

describe("GitHubConnector.fetchCommits", () => {
  it("collects commits across all branches, deduplicated by sha", async () => {
    const connector = new GitHubConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));

    expect(commits).toHaveLength(3);
    expect(commits.map((c) => c.sha).sort()).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("does not populate additions/deletions (v1 scope decision)", async () => {
    const connector = new GitHubConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    for (const commit of commits) {
      expect(commit.additions).toBeUndefined();
      expect(commit.deletions).toBeUndefined();
    }
  });

  it("maps author handle, email, message, and authoredAt correctly", async () => {
    const connector = new GitHubConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    const bob = commits.find((c) => c.sha === "ccc");

    expect(bob).toMatchObject({
      authorHandle: "bob",
      authorEmail: "bob@example.com",
      message: "feature work",
    });
    expect(bob!.authoredAt).toEqual(new Date("2026-01-03T00:00:00Z"));
  });

  it("throws GitHubConnectorError with a clear message when the API call fails", async () => {
    const failingOctokit: OctokitLike = {
      repos: { listBranches: "b", listCommits: "c" },
      paginate: async (fn) => {
        if (fn === "b") return [{ name: "main" }] as never;
        throw new Error("HTTP 403: rate limit exceeded");
      },
    };

    const connector = new GitHubConnector({
      owner: "acme",
      repo: "widgets",
      octokit: failingOctokit,
    });

    await expect(connector.fetchCommits(new Date("2020-01-01"))).rejects.toThrow(
      GitHubConnectorError
    );
  });
});

describe("GitHubConnector.fetchAuthors", () => {
  it("returns unique identities keyed by email", async () => {
    const connector = new GitHubConnector({
      owner: "acme",
      repo: "widgets",
      octokit: fakeOctokit(),
    });

    const authors = await connector.fetchAuthors();

    expect(authors).toHaveLength(2);
    expect(authors.map((a) => a.email).sort()).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });
});

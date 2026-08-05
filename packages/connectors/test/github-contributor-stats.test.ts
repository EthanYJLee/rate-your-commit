import { describe, expect, it } from "vitest";
import { GitHubConnector, GitHubConnectorError } from "../src/github";
import type { OctokitLike } from "../src/github";

function fakeOctokit(overrides: Partial<OctokitLike> = {}): OctokitLike {
  return {
    paginate: async () => [],
    repos: { listBranches: "b", listCommits: "c" },
    ...overrides,
  };
}

describe("GitHubConnector.fetchContributorStats", () => {
  it("maps a 200 response into weekly per-author stats", async () => {
    const octokit = fakeOctokit({
      repos: {
        listBranches: "b",
        listCommits: "c",
        getContributorsStats: async () => ({
          status: 200,
          data: [
            {
              author: { login: "alice" },
              weeks: [
                { w: 1735689600, a: 100, d: 20, c: 3 },
                { w: 1736294400, a: 50, d: 5, c: 1 },
              ],
            },
            // Bot/no-account author — should be dropped, not crash.
            { author: null, weeks: [{ w: 1735689600, a: 1, d: 0, c: 1 }] },
          ],
        }),
      },
    });

    const connector = new GitHubConnector({ owner: "acme", repo: "widgets", octokit });
    const result = await connector.fetchContributorStats();

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].authorHandle).toBe("alice");
    expect(result.stats[0].weeks[0]).toEqual({
      weekStart: new Date(1735689600 * 1000),
      additions: 100,
      deletions: 20,
      commits: 3,
    });
  });

  it("returns pending when GitHub hasn't finished computing the cache (202)", async () => {
    const octokit = fakeOctokit({
      repos: {
        listBranches: "b",
        listCommits: "c",
        getContributorsStats: async () => ({ status: 202, data: undefined }),
      },
    });

    const connector = new GitHubConnector({ owner: "acme", repo: "widgets", octokit });
    const result = await connector.fetchContributorStats();

    expect(result).toEqual({ status: "pending" });
  });

  it("throws GitHubConnectorError on a real API failure", async () => {
    const octokit = fakeOctokit({
      repos: {
        listBranches: "b",
        listCommits: "c",
        getContributorsStats: async () => {
          throw new Error("HTTP 500");
        },
      },
    });

    const connector = new GitHubConnector({ owner: "acme", repo: "widgets", octokit });

    await expect(connector.fetchContributorStats()).rejects.toThrow(GitHubConnectorError);
  });
});

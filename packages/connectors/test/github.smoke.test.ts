import { describe, expect, it } from "vitest";
import { GitHubConnector } from "../src/github";

/**
 * Live integration smoke test — opt-in only. Skipped unless both env
 * vars are set, so `npm test` / CI stay green without real GitHub
 * credentials. To run it yourself:
 *
 *   GITHUB_TOKEN=ghp_xxx GITHUB_SMOKE_TEST_REPO=owner/repo npx vitest run test/github.smoke.test.ts
 */
const token = process.env.GITHUB_TOKEN;
const repoSlug = process.env.GITHUB_SMOKE_TEST_REPO;

describe.skipIf(!token || !repoSlug)("GitHubConnector (live API smoke test)", () => {
  it("fetches real commits and authors from a live repository", async () => {
    const [owner, repo] = (repoSlug as string).split("/");
    const connector = new GitHubConnector({ owner, repo, token });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]).toHaveProperty("sha");
    expect(commits[0]).toHaveProperty("authorHandle");

    const authors = await connector.fetchAuthors();
    expect(authors.length).toBeGreaterThan(0);
  }, 30_000);
});

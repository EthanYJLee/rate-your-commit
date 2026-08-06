import { describe, expect, it } from "vitest";
import { GitLabConnector } from "../src/gitlab";

/**
 * Live integration smoke test — opt-in only. Skipped unless both env
 * vars are set, so `npm test` / CI stay green without real GitLab
 * credentials. To run it yourself (works against gitlab.com or a
 * self-hosted instance via GITLAB_SMOKE_TEST_BASE_URL):
 *
 *   GITLAB_TOKEN=glpat-xxx GITLAB_SMOKE_TEST_PROJECT=group/project \
 *     npx vitest run test/gitlab.smoke.test.ts
 */
const token = process.env.GITLAB_TOKEN;
const projectPath = process.env.GITLAB_SMOKE_TEST_PROJECT;
const baseUrl = process.env.GITLAB_SMOKE_TEST_BASE_URL;

describe.skipIf(!token || !projectPath)("GitLabConnector (live API smoke test)", () => {
  it("fetches real commits and authors from a live project", async () => {
    const connector = new GitLabConnector({
      projectPath: projectPath as string,
      token,
      baseUrl,
    });

    const commits = await connector.fetchCommits(new Date("2020-01-01"));
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]).toHaveProperty("sha");
    expect(commits[0]).toHaveProperty("authorHandle");

    const authors = await connector.fetchAuthors();
    expect(authors.length).toBeGreaterThan(0);
  }, 30_000);
});

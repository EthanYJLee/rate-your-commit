import { describe, expect, it } from "vitest";
import { GitLabIssuesConnector } from "../src/gitlab/issues";

/**
 * Live integration smoke test — opt-in only. Skipped unless both env
 * vars are set, so `npm test` / CI stay green without real GitLab
 * credentials. To run it yourself:
 *
 *   GITLAB_TOKEN=glpat-xxx GITLAB_SMOKE_TEST_PROJECT=group/project \
 *     npx vitest run test/gitlab-issues.smoke.test.ts
 */
const token = process.env.GITLAB_TOKEN;
const projectPath = process.env.GITLAB_SMOKE_TEST_PROJECT;
const baseUrl = process.env.GITLAB_SMOKE_TEST_BASE_URL;

describe.skipIf(!token || !projectPath)("GitLabIssuesConnector (live API smoke test)", () => {
  it("fetches real issues from a live project", async () => {
    const connector = new GitLabIssuesConnector({
      projectPath: projectPath as string,
      token,
      baseUrl,
    });

    const tickets = await connector.fetchTickets(new Date("2020-01-01"));
    if (tickets.length > 0) {
      expect(tickets[0]).toHaveProperty("id");
      expect(tickets[0]).toHaveProperty("status");
    }
  }, 30_000);
});

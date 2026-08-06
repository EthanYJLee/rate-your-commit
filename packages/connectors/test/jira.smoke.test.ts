import { describe, expect, it } from "vitest";
import { JiraConnector } from "../src/jira";

/**
 * Live integration smoke test — opt-in only. Skipped unless all env
 * vars are set, so `npm test` / CI stay green without real Jira
 * credentials. To run it yourself (Jira Cloud only — see
 * src/jira/index.ts's doc comment for why Server/Data Center isn't
 * supported):
 *
 *   JIRA_BASE_URL=https://yoursite.atlassian.net JIRA_EMAIL=you@example.com \
 *     JIRA_API_TOKEN=xxx JIRA_SMOKE_TEST_PROJECT=OP \
 *     npx vitest run test/jira.smoke.test.ts
 */
const baseUrl = process.env.JIRA_BASE_URL;
const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const projectKey = process.env.JIRA_SMOKE_TEST_PROJECT;

describe.skipIf(!baseUrl || !email || !apiToken || !projectKey)(
  "JiraConnector (live API smoke test)",
  () => {
    it("fetches real tickets from a live Jira Cloud project", async () => {
      const connector = new JiraConnector({
        baseUrl: baseUrl as string,
        email,
        apiToken,
        projectKey: projectKey as string,
      });

      const tickets = await connector.fetchTickets(new Date("2020-01-01"));
      // A project may legitimately have zero issues in range, so just
      // assert the shape rather than requiring non-empty results.
      if (tickets.length > 0) {
        expect(tickets[0]).toHaveProperty("id");
        expect(tickets[0]).toHaveProperty("status");
      }
    }, 30_000);
  }
);

import { describe, expect, it } from "vitest";
import { LinearConnector } from "../src/linear";

/**
 * Live integration smoke test — opt-in only. Skipped unless both env
 * vars are set, so `npm test` / CI stay green without real Linear
 * credentials. To run it yourself:
 *
 *   LINEAR_API_KEY=lin_api_xxx LINEAR_SMOKE_TEST_TEAM_KEY=ENG \
 *     npx vitest run test/linear.smoke.test.ts
 */
const apiKey = process.env.LINEAR_API_KEY;
const teamKey = process.env.LINEAR_SMOKE_TEST_TEAM_KEY;

describe.skipIf(!apiKey || !teamKey)("LinearConnector (live API smoke test)", () => {
  it("fetches real issues from a live Linear team", async () => {
    const connector = new LinearConnector({ teamKey: teamKey as string, apiKey });

    const tickets = await connector.fetchTickets(new Date("2020-01-01"));
    // A team may legitimately have zero issues in range, so just
    // assert the shape rather than requiring non-empty results.
    if (tickets.length > 0) {
      expect(tickets[0]).toHaveProperty("id");
      expect(tickets[0]).toHaveProperty("status");
    }
  }, 30_000);
});

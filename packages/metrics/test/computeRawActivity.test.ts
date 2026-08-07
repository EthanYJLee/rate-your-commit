import { describe, expect, it } from "vitest";
import { computeRawActivity } from "../src/computeAxisMetrics";
import type { CommitForMetrics, TicketForMetrics } from "../src/types";

const JANUARY = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") };

function commit(authoredAt: string, excludedFlag = false): CommitForMetrics {
  return { authoredAt: new Date(authoredAt), excludedFlag };
}

function ticket(createdAt: string, closedAt?: string): TicketForMetrics {
  return { createdAt: new Date(createdAt), closedAt: closedAt ? new Date(closedAt) : undefined };
}

describe("computeRawActivity", () => {
  it("returns all zeros when there's no activity at all", () => {
    expect(computeRawActivity([], [], JANUARY)).toEqual({
      commitCount: 0,
      excludedCommitCount: 0,
      ticketCount: 0,
      closedTicketCount: 0,
    });
  });

  it("counts commits within the period, ignoring commits outside it", () => {
    const commits = [commit("2025-12-31"), commit("2026-01-05"), commit("2026-01-20")];
    const result = computeRawActivity(commits, [], JANUARY);
    expect(result.commitCount).toBe(2);
  });

  it("counts excluded commits separately from the total", () => {
    const commits = [commit("2026-01-05", true), commit("2026-01-10"), commit("2026-01-15", true)];
    const result = computeRawActivity(commits, [], JANUARY);
    expect(result.commitCount).toBe(3);
    expect(result.excludedCommitCount).toBe(2);
  });

  it("counts tickets active in the period and how many closed within it", () => {
    const tickets = [
      ticket("2026-01-02", "2026-01-15"), // active, closed in-period
      ticket("2026-01-05", undefined), // active, still open
      ticket("2025-06-01", "2025-06-10"), // closed long before the period — not active
    ];
    const result = computeRawActivity([], tickets, JANUARY);
    expect(result.ticketCount).toBe(2);
    expect(result.closedTicketCount).toBe(1);
  });

  it("still returns zero counts when only the OTHER data type has activity", () => {
    const result = computeRawActivity([commit("2026-01-05")], [], JANUARY);
    expect(result.ticketCount).toBe(0);
    expect(result.closedTicketCount).toBe(0);
  });

  it("does not double-count a closed ticket as active if it closed before the period started", () => {
    const tickets = [ticket("2025-11-01", "2025-11-15")];
    const result = computeRawActivity([], tickets, JANUARY);
    expect(result.ticketCount).toBe(0);
  });
});

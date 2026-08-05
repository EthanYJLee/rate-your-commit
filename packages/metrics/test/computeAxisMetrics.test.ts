import { describe, expect, it } from "vitest";
import { computeAxisMetrics, NO_ACTIVITY_DEFAULT, UNIMPLEMENTED_AXIS_PLACEHOLDER } from "../src/computeAxisMetrics";
import type { CommitForMetrics, TicketForMetrics } from "../src/types";

const JANUARY = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") };

function commit(authoredAt: string, excludedFlag = false): CommitForMetrics {
  return { authoredAt: new Date(authoredAt), excludedFlag };
}

function ticket(createdAt: string, closedAt?: string): TicketForMetrics {
  return { createdAt: new Date(createdAt), closedAt: closedAt ? new Date(closedAt) : undefined };
}

describe("computeAxisMetrics", () => {
  it("quality: 100 when no commits are excluded", () => {
    const commits = [commit("2026-01-05"), commit("2026-01-10"), commit("2026-01-20")];
    const result = computeAxisMetrics(commits, [], JANUARY);
    expect(result.quality).toBe(100);
  });

  it("quality: reflects the excluded-commit ratio for the period", () => {
    const commits = [
      commit("2026-01-05", true),
      commit("2026-01-10"),
      commit("2026-01-15"),
      commit("2026-01-20"),
    ];
    const result = computeAxisMetrics(commits, [], JANUARY);
    expect(result.quality).toBe(75); // 3 of 4 not excluded
  });

  it("quality: ignores commits outside the period", () => {
    const commits = [commit("2025-12-31", true), commit("2026-01-10")];
    const result = computeAxisMetrics(commits, [], JANUARY);
    expect(result.quality).toBe(100); // only the in-period, non-excluded commit counts
  });

  it("quality: defaults to NO_ACTIVITY_DEFAULT with zero commits in period", () => {
    const result = computeAxisMetrics([], [], JANUARY);
    expect(result.quality).toBe(NO_ACTIVITY_DEFAULT);
  });

  it("delivery: 100% when every active ticket was closed in-period", () => {
    const tickets = [ticket("2026-01-01", "2026-01-15"), ticket("2026-01-05", "2026-01-20")];
    const result = computeAxisMetrics([], tickets, JANUARY);
    expect(result.delivery).toBe(100);
  });

  it("delivery: reflects a partial completion rate", () => {
    const tickets = [
      ticket("2026-01-01", "2026-01-15"), // closed in period
      ticket("2026-01-05"), // still open — active, not closed
      ticket("2025-12-20", "2026-01-10"), // opened earlier, closed in period — still active-in-period
    ];
    const result = computeAxisMetrics([], tickets, JANUARY);
    expect(result.delivery).toBe(66.7); // 2 of 3 active tickets closed in-period (rounded to 1dp)
  });

  it("delivery: excludes tickets closed before the period started", () => {
    const tickets = [ticket("2025-12-01", "2025-12-20")]; // fully resolved before January
    const result = computeAxisMetrics([], tickets, JANUARY);
    expect(result.delivery).toBe(NO_ACTIVITY_DEFAULT); // no active tickets this period
  });

  it("delivery: excludes tickets created after the period ended", () => {
    const tickets = [ticket("2026-02-05")];
    const result = computeAxisMetrics([], tickets, JANUARY);
    expect(result.delivery).toBe(NO_ACTIVITY_DEFAULT);
  });

  it("collaboration and evaluation are constant placeholders", () => {
    const result = computeAxisMetrics([commit("2026-01-05")], [ticket("2026-01-01")], JANUARY);
    expect(result.collaboration).toBe(UNIMPLEMENTED_AXIS_PLACEHOLDER);
    expect(result.evaluation).toBe(UNIMPLEMENTED_AXIS_PLACEHOLDER);
  });
});

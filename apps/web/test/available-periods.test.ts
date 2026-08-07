import { describe, expect, it, vi } from "vitest";
import { currentMonthPeriod } from "@rateyourcommit/metrics";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { listAvailablePeriods } = await import("../lib/available-periods");

describe("listAvailablePeriods", () => {
  it("filters to rows with real activity (commitCount or ticketCount > 0)", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { periodStart: currentMonthPeriod().start, periodEnd: currentMonthPeriod().end },
    ]);

    await listAvailablePeriods();

    const call = mockPrisma.scoreResult.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      OR: [{ commitCount: { gt: 0 } }, { ticketCount: { gt: 0 } }],
    });
  });

  it("returns the periods found, newest first, as-is when the current month is among them", async () => {
    const current = currentMonthPeriod();
    const past = { start: new Date("2023-03-01T00:00:00Z"), end: new Date("2023-04-01T00:00:00Z") };
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { periodStart: current.start, periodEnd: current.end },
      { periodStart: past.start, periodEnd: past.end },
    ]);

    const periods = await listAvailablePeriods();

    expect(periods).toEqual([current, past]);
  });

  it("adds the current month even when nothing's been scored for it yet (no real activity, or too new)", async () => {
    const past = { start: new Date("2023-03-01T00:00:00Z"), end: new Date("2023-04-01T00:00:00Z") };
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { periodStart: past.start, periodEnd: past.end },
    ]);

    const periods = await listAvailablePeriods();

    expect(periods).toEqual([currentMonthPeriod(), past]);
  });

  it("does not include a month that only has empty/no-activity ScoreResult rows (the where clause already excludes them at the query level)", async () => {
    // Simulates the DB having zero rows for a gap year like 2024/2025
    // because every row in that span has commitCount=0 and
    // ticketCount=0 — the `where` filter above means Prisma itself
    // never returns them, so there's nothing further to filter here.
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);

    const periods = await listAvailablePeriods();

    expect(periods).toEqual([currentMonthPeriod()]);
  });
});

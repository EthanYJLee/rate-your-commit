import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMonthPeriod } from "@rateyourcommit/metrics";

const mockPrisma = {
  scoreWeightConfig: { findFirst: vi.fn(), create: vi.fn() },
  person: { findMany: vi.fn() },
  scoreResult: { upsert: vi.fn() },
  commit: { aggregate: vi.fn() },
  ticket: { aggregate: vi.fn() },
  scoreConfirmation: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma, DEFAULT_ORGANIZATION_ID: "default" }));

const { computeAndPersistScoresForAllPeriods } = await import("../src/index");

const DEFAULT_WEIGHTS = { delivery: 50, quality: 50, collaboration: 0, evaluation: 0 };

describe("computeAndPersistScoresForAllPeriods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(DEFAULT_WEIGHTS);
    mockPrisma.scoreResult.upsert.mockResolvedValue({});
    mockPrisma.person.findMany.mockResolvedValue([]);
    mockPrisma.scoreConfirmation.findMany.mockResolvedValue([]);
  });

  it("computes only the current month when there is no commit/ticket activity anywhere yet", async () => {
    mockPrisma.commit.aggregate.mockResolvedValue({ _min: { authoredAt: null } });
    mockPrisma.ticket.aggregate.mockResolvedValue({ _min: { createdAt: null } });

    const totalScored = await computeAndPersistScoresForAllPeriods();

    expect(totalScored).toBe(0); // no people, but shouldn't throw
    // person.findMany is called once per period computed — exactly
    // one call proves exactly one (the current) month was computed.
    expect(mockPrisma.person.findMany).toHaveBeenCalledTimes(1);
  });

  it("backfills every month from the earliest commit through the current month", async () => {
    mockPrisma.commit.aggregate.mockResolvedValue({
      _min: { authoredAt: new Date("2026-01-15T00:00:00Z") },
    });
    mockPrisma.ticket.aggregate.mockResolvedValue({ _min: { createdAt: null } });

    const now = new Date();
    const expectedMonths =
      (now.getUTCFullYear() - 2026) * 12 + (now.getUTCMonth() - 0) + 1; // Jan (month 0) through this month

    await computeAndPersistScoresForAllPeriods();

    expect(mockPrisma.person.findMany).toHaveBeenCalledTimes(expectedMonths);
  });

  it("uses the earlier of the earliest commit and earliest ticket as the backfill start", async () => {
    mockPrisma.commit.aggregate.mockResolvedValue({
      _min: { authoredAt: new Date("2026-06-01T00:00:00Z") },
    });
    mockPrisma.ticket.aggregate.mockResolvedValue({
      _min: { createdAt: new Date("2026-02-01T00:00:00Z") },
    });

    const now = new Date();
    const expectedMonths = (now.getUTCFullYear() - 2026) * 12 + (now.getUTCMonth() - 1) + 1; // Feb onward

    await computeAndPersistScoresForAllPeriods();

    expect(mockPrisma.person.findMany).toHaveBeenCalledTimes(expectedMonths);
  });

  it("sums scored counts across every backfilled period", async () => {
    mockPrisma.commit.aggregate.mockResolvedValue({
      _min: { authoredAt: currentMonthPeriod().start },
    });
    mockPrisma.ticket.aggregate.mockResolvedValue({ _min: { createdAt: null } });
    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [
          {
            commits: [{ authoredAt: currentMonthPeriod().start, excludedFlag: false }],
            tickets: [],
          },
        ],
      },
    ]);

    const totalScored = await computeAndPersistScoresForAllPeriods();

    expect(totalScored).toBe(1);
  });

  it("skips a period that already has a ScoreConfirmation row, without touching person.findMany for it", async () => {
    mockPrisma.commit.aggregate.mockResolvedValue({
      _min: { authoredAt: new Date("2026-06-01T00:00:00Z") },
    });
    mockPrisma.ticket.aggregate.mockResolvedValue({ _min: { createdAt: null } });
    // Confirm the earliest month (2026-06) — everything else in the
    // backfill range is still open.
    mockPrisma.scoreConfirmation.findMany.mockResolvedValue([
      { periodStart: new Date(Date.UTC(2026, 5, 1)) },
    ]);

    const now = new Date();
    const totalMonthsInRange = (now.getUTCFullYear() - 2026) * 12 + (now.getUTCMonth() - 5) + 1;

    await computeAndPersistScoresForAllPeriods();

    // One fewer than the full range, since June is confirmed and skipped.
    expect(mockPrisma.person.findMany).toHaveBeenCalledTimes(totalMonthsInRange - 1);
  });
});

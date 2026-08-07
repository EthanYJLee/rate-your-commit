import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMonthPeriod } from "@rateyourcommit/metrics";

const mockPrisma = {
  scoreWeightConfig: { findFirst: vi.fn(), create: vi.fn() },
  person: { findMany: vi.fn() },
  scoreResult: { upsert: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma, DEFAULT_ORGANIZATION_ID: "default" }));

const { computeAndPersistScores } = await import("../src/index");

const DEFAULT_WEIGHTS = { delivery: 50, quality: 50, collaboration: 0, evaluation: 0 };
const period = currentMonthPeriod();

describe("computeAndPersistScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(DEFAULT_WEIGHTS);
    mockPrisma.scoreResult.upsert.mockResolvedValue({});
  });

  it("creates a default 50/50/0/0 weight config the first time it runs", async () => {
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(null);
    mockPrisma.scoreWeightConfig.create.mockResolvedValue(DEFAULT_WEIGHTS);
    mockPrisma.person.findMany.mockResolvedValue([]);

    await computeAndPersistScores(period);

    expect(mockPrisma.scoreWeightConfig.create).toHaveBeenCalledWith({
      data: {
        organizationId: "default",
        delivery: 50,
        quality: 50,
        collaboration: 0,
        evaluation: 0,
      },
    });
  });

  it("skips people with no commits or tickets at all", async () => {
    mockPrisma.person.findMany.mockResolvedValue([
      { id: "person-1", identities: [{ commits: [], tickets: [] }] },
    ]);

    const count = await computeAndPersistScores(period);

    expect(count).toBe(0);
    expect(mockPrisma.scoreResult.upsert).not.toHaveBeenCalled();
  });

  it("aggregates commits/tickets across all of a person's identities and upserts a ScoreResult", async () => {
    const inPeriod = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 10));

    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [
          { commits: [{ authoredAt: inPeriod, excludedFlag: false }], tickets: [] },
          { commits: [], tickets: [{ createdAt: inPeriod, closedAt: inPeriod }] },
        ],
      },
    ]);

    const count = await computeAndPersistScores(period);

    expect(count).toBe(1);
    expect(mockPrisma.scoreResult.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.scoreResult.upsert.mock.calls[0][0];
    expect(call.create.personId).toBe("person-1");
    expect(call.create.quality).toBe(100); // one commit, not excluded
    expect(call.create.delivery).toBe(100); // one ticket, closed in-period
    expect(call.create.finalScore).toBe(100);
    expect(call.create.grade).toBe("S");
    // Reference-only raw activity counts, computed from the same
    // commit/ticket sets — see ScoreResult's schema doc comment.
    expect(call.create.commitCount).toBe(1);
    expect(call.create.excludedCommitCount).toBe(0);
    expect(call.create.ticketCount).toBe(1);
    expect(call.create.closedTicketCount).toBe(1);
  });

  it("persists non-zero excludedCommitCount for an outlier-flagged commit, distinct from the quality percentage", async () => {
    const inPeriod = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 10));

    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [
          {
            commits: [
              { authoredAt: inPeriod, excludedFlag: true },
              { authoredAt: inPeriod, excludedFlag: false },
            ],
            tickets: [],
          },
        ],
      },
    ]);

    await computeAndPersistScores(period);

    const call = mockPrisma.scoreResult.upsert.mock.calls[0][0];
    expect(call.create.commitCount).toBe(2);
    expect(call.create.excludedCommitCount).toBe(1);
  });

  it("upserts using the given period's start/end, not necessarily the current month", async () => {
    const pastPeriod = { start: new Date("2023-05-01T00:00:00Z"), end: new Date("2023-06-01T00:00:00Z") };
    const inPastPeriod = new Date("2023-05-10T00:00:00Z");

    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [{ commits: [{ authoredAt: inPastPeriod, excludedFlag: false }], tickets: [] }],
      },
    ]);

    await computeAndPersistScores(pastPeriod);

    const call = mockPrisma.scoreResult.upsert.mock.calls[0][0];
    expect(call.create.periodStart).toEqual(pastPeriod.start);
    expect(call.create.periodEnd).toEqual(pastPeriod.end);
  });

  it("counts a currently-open ticket (closedAt: null, Prisma's actual shape for a nullable column — not undefined) as active, not as 0% delivery via NO_ACTIVITY_DEFAULT", async () => {
    const inPeriod = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 10));

    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [
          { commits: [], tickets: [{ createdAt: inPeriod, closedAt: null }] },
        ],
      },
    ]);

    const count = await computeAndPersistScores(period);

    expect(count).toBe(1);
    const call = mockPrisma.scoreResult.upsert.mock.calls[0][0];
    // One active (open) ticket, zero closed in-period -> 0%, NOT the
    // NO_ACTIVITY_DEFAULT of 100 that a `null`-treated-as-"filtered
    // out entirely" bug would have produced.
    expect(call.create.delivery).toBe(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  scoreWeightConfig: { findFirst: vi.fn(), create: vi.fn() },
  person: { findMany: vi.fn() },
  scoreResult: { upsert: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma, DEFAULT_ORGANIZATION_ID: "default" }));

const { computeAndPersistScores } = await import("../src/index");

const DEFAULT_WEIGHTS = { delivery: 50, quality: 50, collaboration: 0, evaluation: 0 };

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

    await computeAndPersistScores();

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

    const count = await computeAndPersistScores();

    expect(count).toBe(0);
    expect(mockPrisma.scoreResult.upsert).not.toHaveBeenCalled();
  });

  it("aggregates commits/tickets across all of a person's identities and upserts a ScoreResult", async () => {
    const now = new Date();
    const inPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10));

    mockPrisma.person.findMany.mockResolvedValue([
      {
        id: "person-1",
        identities: [
          { commits: [{ authoredAt: inPeriod, excludedFlag: false }], tickets: [] },
          { commits: [], tickets: [{ createdAt: inPeriod, closedAt: inPeriod }] },
        ],
      },
    ]);

    const count = await computeAndPersistScores();

    expect(count).toBe(1);
    expect(mockPrisma.scoreResult.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.scoreResult.upsert.mock.calls[0][0];
    expect(call.create.personId).toBe("person-1");
    expect(call.create.quality).toBe(100); // one commit, not excluded
    expect(call.create.delivery).toBe(100); // one ticket, closed in-period
    expect(call.create.finalScore).toBe(100);
    expect(call.create.grade).toBe("S");
  });
});

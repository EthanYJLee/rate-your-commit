import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutlierWeek } from "@rateyourcommit/metrics";

const mockPrisma = {
  identity: { findMany: vi.fn() },
  commit: { updateMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { applyOutlierFlags } = await import("../src/index");

function outlierWeek(overrides: Partial<OutlierWeek> = {}): OutlierWeek {
  return {
    authorHandle: "alice",
    weekStart: new Date("2026-01-05T00:00:00Z"),
    weekEnd: new Date("2026-01-12T00:00:00Z"),
    totalLines: 8000,
    medianLines: 100,
    reason: "LOC outlier: 8000 lines changed, 5x median (100).",
    ...overrides,
  };
}

describe("applyOutlierFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags every commit in the outlier author-week window", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([{ id: "identity-1" }]);
    mockPrisma.commit.updateMany.mockResolvedValue({ count: 3 });

    const count = await applyOutlierFlags("project-1", [outlierWeek()]);

    expect(count).toBe(3);
    expect(mockPrisma.identity.findMany).toHaveBeenCalledWith({
      where: { handle: "alice" },
      select: { id: true },
    });
    expect(mockPrisma.commit.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        identityId: { in: ["identity-1"] },
        authoredAt: { gte: new Date("2026-01-05T00:00:00Z"), lt: new Date("2026-01-12T00:00:00Z") },
      },
      data: { excludedFlag: true, excludedReason: outlierWeek().reason },
    });
  });

  it("matches on every Identity row sharing the handle, not just one", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([{ id: "id-a" }, { id: "id-b" }]);
    mockPrisma.commit.updateMany.mockResolvedValue({ count: 5 });

    await applyOutlierFlags("project-1", [outlierWeek()]);

    expect(mockPrisma.commit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ identityId: { in: ["id-a", "id-b"] } }),
      })
    );
  });

  it("skips safely when no Identity matches the outlier's handle", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([]);

    const count = await applyOutlierFlags("project-1", [outlierWeek({ authorHandle: "ghost" })]);

    expect(count).toBe(0);
    expect(mockPrisma.commit.updateMany).not.toHaveBeenCalled();
  });

  it("sums flagged counts across multiple outlier weeks", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([{ id: "identity-1" }]);
    mockPrisma.commit.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 4 });

    const count = await applyOutlierFlags("project-1", [
      outlierWeek({ weekStart: new Date("2026-01-05T00:00:00Z") }),
      outlierWeek({ weekStart: new Date("2026-02-02T00:00:00Z") }),
    ]);

    expect(count).toBe(6);
  });
});

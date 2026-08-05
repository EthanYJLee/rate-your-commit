import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

// Imported after the mock so the page module picks up the mocked client.
const { default: ScorecardPage } = await import("../app/scorecard/page");

describe("/scorecard page", () => {
  it("shows the empty-state hint when no ScoreResult exists yet for this period", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await ScorecardPage());

    expect(html).toContain("이번 달 계산된 스코어가 아직 없습니다");
  });

  it("renders each person's axis scores, final score, and grade", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      {
        id: "score-1",
        person: { displayName: "Alice Real" },
        delivery: 90,
        quality: 85,
        collaboration: 100,
        evaluation: 100,
        finalScore: 87.5,
        grade: "A",
      },
    ]);

    const html = renderToStaticMarkup(await ScorecardPage());

    expect(html).toContain("Alice Real");
    expect(html).toContain("87.5");
    expect(html).toContain(">A<");
  });

  it("queries scoreResult scoped to the current calendar month", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);

    await ScorecardPage();

    const call = mockPrisma.scoreResult.findMany.mock.calls[0][0];
    expect(call.where.periodStart).toBeInstanceOf(Date);
    expect(call.where.periodEnd.getTime()).toBeGreaterThan(call.where.periodStart.getTime());
  });
});

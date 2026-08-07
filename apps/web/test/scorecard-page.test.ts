import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
  identity: { count: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

// Imported after the mock so the page module picks up the mocked client.
const { default: ScorecardPage } = await import("../app/scorecard/page");

describe("/scorecard page", () => {
  it("shows the empty-state hint when no ScoreResult exists yet for this period", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("계산된 스코어가 아직 없습니다");
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
        commitCount: 0,
        excludedCommitCount: 0,
        ticketCount: 0,
        closedTicketCount: 0,
      },
    ]);
    mockPrisma.identity.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Alice Real");
    expect(html).toContain("87.5");
    expect(html).toContain(">A<");
  });

  it("shows '-' for the reference-only commit/ticket columns when there's no activity", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      {
        id: "score-1",
        person: { displayName: "Alice Real" },
        delivery: 100,
        quality: 100,
        collaboration: 100,
        evaluation: 100,
        finalScore: 100,
        grade: "S",
        commitCount: 0,
        excludedCommitCount: 0,
        ticketCount: 0,
        closedTicketCount: 0,
      },
    ]);
    mockPrisma.identity.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain(">-<");
  });

  it("shows commit/ticket counts with excluded/closed breakdowns when there's real activity", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      {
        id: "score-1",
        person: { displayName: "Alice Real" },
        delivery: 100,
        quality: 66.7,
        collaboration: 100,
        evaluation: 100,
        finalScore: 90,
        grade: "S",
        commitCount: 12,
        excludedCommitCount: 4,
        ticketCount: 3,
        closedTicketCount: 2,
      },
    ]);
    mockPrisma.identity.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("12 (이상치 4)");
    expect(html).toContain("3 (완료 2)");
  });

  it("queries scoreResult scoped to the current calendar month", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);

    await ScorecardPage({ searchParams: Promise.resolve({}) });

    const call = mockPrisma.scoreResult.findMany.mock.calls.at(-2)![0];
    expect(call.where.periodStart).toBeInstanceOf(Date);
    expect(call.where.periodEnd.getTime()).toBeGreaterThan(call.where.periodStart.getTime());
  });

  it("shows a warning banner when unresolved identities exist", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(3);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("미해결 아이덴티티가 3개 있습니다");
    expect(mockPrisma.identity.count).toHaveBeenCalledWith({ where: { personId: null } });
  });

  it("shows no warning banner when there are no unresolved identities", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await ScorecardPage({ searchParams: Promise.resolve({}) }));

    expect(html).not.toContain("미해결 아이덴티티가");
  });
});

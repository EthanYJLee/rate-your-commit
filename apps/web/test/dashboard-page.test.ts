import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
  identity: { count: vi.fn() },
  commit: { count: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { default: DashboardPage } = await import("../app/page");

describe("/ dashboard page", () => {
  it("shows a dash for average score when nobody has a ScoreResult yet", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("—");
  });

  it("computes the average score and grade distribution from ScoreResult rows", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { finalScore: 90, grade: "S" },
      { finalScore: 70, grade: "B" },
      { finalScore: 80, grade: "A" },
    ]);
    mockPrisma.identity.count.mockResolvedValue(2);
    mockPrisma.commit.count.mockResolvedValue(1);

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("80"); // (90+70+80)/3 = 80
    expect(html).toContain("미해결 아이덴티티 큐");
  });

  it("scopes the outlier-commit count to the current calendar month", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    await DashboardPage();

    const call = mockPrisma.commit.count.mock.calls[0][0];
    expect(call.where.excludedFlag).toBe(true);
    expect(call.where.authoredAt.gte).toBeInstanceOf(Date);
    expect(call.where.authoredAt.lt.getTime()).toBeGreaterThan(call.where.authoredAt.gte.getTime());
  });

  it("links each stat to its source screen", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain('href="/scorecard"');
    expect(html).toContain('href="/identities"');
  });
});

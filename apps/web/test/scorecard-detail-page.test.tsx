import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  person: { findUnique: vi.fn() },
  scoreResult: { findUnique: vi.fn(), findMany: vi.fn() },
};

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));

const { default: ScorecardDetailPage } = await import("../app/scorecard/[personId]/page");

function paramsFor(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

describe("/scorecard/[personId] page", () => {
  it("calls notFound() when the person doesn't exist", async () => {
    mockPrisma.person.findUnique.mockResolvedValue(null);

    await expect(ScorecardDetailPage(paramsFor("missing"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows an empty state when this person has no ScoreResult for the current period", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue(null);
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await ScorecardDetailPage(paramsFor("p1")));

    expect(html).toContain("Alice");
    expect(html).toContain("이번 달 계산된 스코어가 아직 없습니다");
  });

  it("renders the gauge/grade and radar values from own vs org-wide-average ScoreResult rows", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: "EMP-1" });
    mockPrisma.scoreResult.findUnique.mockResolvedValue({
      delivery: 88,
      quality: 74,
      collaboration: 80,
      evaluation: 91,
      finalScore: 82.5,
      grade: "S",
    });
    mockPrisma.scoreResult.findMany.mockImplementation((args: { orderBy?: unknown }) => {
      if (args?.orderBy) {
        // trend query — mocked as the real query returns it: newest first.
        return Promise.resolve([
          { periodStart: new Date(Date.UTC(2026, 7, 1)), finalScore: 82.5 },
          { periodStart: new Date(Date.UTC(2026, 6, 1)), finalScore: 79.5 },
        ]);
      }
      // org-wide average query for this period
      return Promise.resolve([
        { delivery: 60, quality: 60, collaboration: 100, evaluation: 100, finalScore: 60 },
        { delivery: 80, quality: 80, collaboration: 100, evaluation: 100, finalScore: 80 },
      ]);
    });

    const html = renderToStaticMarkup(await ScorecardDetailPage(paramsFor("p1")));

    expect(html).toContain("EMP-1");
    expect(html).toContain("82.5");
    expect(html).toContain("등급 S");
    expect(html).toContain("전사 평균");
  });

  it("shows the trend chart's own empty state when fewer than 2 historical periods exist", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue({
      delivery: 88,
      quality: 74,
      collaboration: 80,
      evaluation: 91,
      finalScore: 82.5,
      grade: "S",
    });
    mockPrisma.scoreResult.findMany.mockImplementation((args: { orderBy?: unknown }) => {
      if (args?.orderBy) return Promise.resolve([{ periodStart: new Date(Date.UTC(2026, 7, 1)), finalScore: 82.5 }]);
      return Promise.resolve([{ delivery: 88, quality: 74, collaboration: 80, evaluation: 91, finalScore: 82.5 }]);
    });

    const html = renderToStaticMarkup(await ScorecardDetailPage(paramsFor("p1")));

    expect(html).toContain("추이를 보기엔 데이터가 부족합니다");
  });

  it("scopes both own-score and trend queries to the given personId", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue(null);
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);

    await ScorecardDetailPage(paramsFor("p1"));

    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(mockPrisma.scoreResult.findUnique.mock.calls[0][0].where.personId_periodStart_periodEnd.personId).toBe(
      "p1",
    );
    const trendCall = mockPrisma.scoreResult.findMany.mock.calls.find((call) => call[0]?.orderBy);
    expect(trendCall?.[0].where.personId).toBe("p1");
    expect(trendCall?.[0].take).toBe(6);
  });
});

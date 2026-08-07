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

function propsFor(personId: string, period?: string) {
  return {
    params: Promise.resolve({ personId }),
    searchParams: Promise.resolve(period ? { period } : {}),
  };
}

/**
 * scoreResult.findMany is called for THREE different purposes on this
 * page (org-wide average, trend, listAvailablePeriods) — distinguish
 * by the shape of the actual Prisma args each one passes, not by
 * hardcoded ordering.
 */
function mockFindManyByShape({
  orgWide = [],
  trend = [],
  availablePeriods = [],
}: {
  orgWide?: unknown[];
  trend?: unknown[];
  availablePeriods?: unknown[];
}) {
  mockPrisma.scoreResult.findMany.mockImplementation((args: { distinct?: unknown; take?: unknown }) => {
    if (args?.distinct) return Promise.resolve(availablePeriods);
    if (args?.take) return Promise.resolve(trend);
    return Promise.resolve(orgWide);
  });
}

describe("/scorecard/[personId] page", () => {
  it("calls notFound() when the person doesn't exist", async () => {
    mockPrisma.person.findUnique.mockResolvedValue(null);
    mockFindManyByShape({});

    await expect(ScorecardDetailPage(propsFor("missing"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows an empty state when this person has no ScoreResult for the selected period", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue(null);
    mockFindManyByShape({});

    const html = renderToStaticMarkup(await ScorecardDetailPage(propsFor("p1")));

    expect(html).toContain("Alice");
    expect(html).toContain("계산된 스코어가 아직 없습니다");
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
    mockFindManyByShape({
      orgWide: [
        { delivery: 60, quality: 60, collaboration: 100, evaluation: 100, finalScore: 60 },
        { delivery: 80, quality: 80, collaboration: 100, evaluation: 100, finalScore: 80 },
      ],
      trend: [
        { periodStart: new Date(Date.UTC(2026, 7, 1)), finalScore: 82.5 },
        { periodStart: new Date(Date.UTC(2026, 6, 1)), finalScore: 79.5 },
      ],
    });

    const html = renderToStaticMarkup(await ScorecardDetailPage(propsFor("p1")));

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
    mockFindManyByShape({
      orgWide: [{ delivery: 88, quality: 74, collaboration: 80, evaluation: 91, finalScore: 82.5 }],
      trend: [{ periodStart: new Date(Date.UTC(2026, 7, 1)), finalScore: 82.5 }],
    });

    const html = renderToStaticMarkup(await ScorecardDetailPage(propsFor("p1")));

    expect(html).toContain("추이를 보기엔 데이터가 부족합니다");
  });

  it("scopes both own-score and trend queries to the given personId", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue(null);
    mockFindManyByShape({});

    await ScorecardDetailPage(propsFor("p1"));

    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(mockPrisma.scoreResult.findUnique.mock.calls[0][0].where.personId_periodStart_periodEnd.personId).toBe(
      "p1",
    );
    const trendCall = mockPrisma.scoreResult.findMany.mock.calls.find((call) => call[0]?.take);
    expect(trendCall?.[0].where.personId).toBe("p1");
    expect(trendCall?.[0].take).toBe(6);
  });

  it("uses the ?period= query param to show a historical period instead of the current month", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "LeeHosik", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue({
      delivery: 100,
      quality: 33.3,
      collaboration: 100,
      evaluation: 100,
      finalScore: 73.3,
      grade: "B",
    });
    mockFindManyByShape({
      orgWide: [{ delivery: 100, quality: 33.3, collaboration: 100, evaluation: 100, finalScore: 73.3 }],
      trend: [{ periodStart: new Date(Date.UTC(2023, 2, 1)), finalScore: 73.3 }],
    });

    const html = renderToStaticMarkup(await ScorecardDetailPage(propsFor("p1", "2023-03")));

    // Regression guard for the bug this test was added for: previously
    // this page ignored ?period= entirely and always queried the
    // CURRENT month, so a historical row's real score never showed up
    // here even though it was correct on the /scorecard list.
    // .at(-1): this file has no beforeEach mock-history reset, so
    // mock.calls[0] would be a stale call from an earlier test in this
    // same file (same convention as dashboard-page.test.ts).
    const ownScoreCall = mockPrisma.scoreResult.findUnique.mock.calls.at(-1)![0];
    expect(ownScoreCall.where.personId_periodStart_periodEnd.periodStart).toEqual(
      new Date(Date.UTC(2023, 2, 1)),
    );
    expect(html).toContain("73.3");
    expect(html).toContain("2023년 3월");
  });

  it("carries the selected period into its own PeriodPicker and the back-link to /scorecard", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "p1", displayName: "Alice", employeeId: null });
    mockPrisma.scoreResult.findUnique.mockResolvedValue(null);
    mockFindManyByShape({ availablePeriods: [{ start: new Date(Date.UTC(2023, 2, 1)), end: new Date(Date.UTC(2023, 3, 1)) }] });

    const html = renderToStaticMarkup(await ScorecardDetailPage(propsFor("p1", "2023-03")));

    expect(html).toContain('href="/scorecard?period=2023-03"');
  });
});

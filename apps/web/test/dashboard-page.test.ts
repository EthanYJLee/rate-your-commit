import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
  identity: { count: vi.fn() },
  commit: { count: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const mockAuth = vi.fn().mockResolvedValue(null);
// Mocked for the same reason every other page/route test mocks
// "../auth": an unmocked `import ... from "next-auth"` fails to
// resolve "next/server" under Vitest — see credentials-sign-in.ts.
vi.mock("../auth", () => ({ auth: mockAuth }));

const { default: DashboardPage } = await import("../app/page");

describe("/ dashboard page", () => {
  it("shows a dash for average score when nobody has a ScoreResult yet", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("—");
  });

  it("shows a '내 스코어카드' link when the signed-in AppUser is linked to a Person", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);
    mockAuth.mockResolvedValueOnce({ user: { personId: "person-1" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('href="/scorecard/person-1"');
    expect(html).toContain("내 스코어카드");
  });

  it("does not show the '내 스코어카드' link when there's no linked person (GitHub sign-in, or an unlinked AppUser)", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);
    mockAuth.mockResolvedValueOnce({ user: { login: "octocat" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).not.toContain("내 스코어카드");
  });

  it("computes the average score and grade distribution from ScoreResult rows", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { finalScore: 90, grade: "S" },
      { finalScore: 70, grade: "B" },
      { finalScore: 80, grade: "A" },
    ]);
    mockPrisma.identity.count.mockResolvedValue(2);
    mockPrisma.commit.count.mockResolvedValue(1);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("80"); // (90+70+80)/3 = 80
    expect(html).toContain("미해결 아이덴티티 큐");
  });

  it("scopes the outlier-commit count to the current calendar month", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    await DashboardPage({ searchParams: Promise.resolve({}) });

    const call = mockPrisma.commit.count.mock.calls[0][0];
    expect(call.where.excludedFlag).toBe(true);
    expect(call.where.authoredAt.gte).toBeInstanceOf(Date);
    expect(call.where.authoredAt.lt.getTime()).toBeGreaterThan(call.where.authoredAt.gte.getTime());
  });

  it("links each stat to its source screen", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('href="/scorecard"');
    expect(html).toContain('href="/identities"');
  });

  it("renders a score-distribution histogram bucketed from finalScore", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { finalScore: 55, grade: "C" },
      { finalScore: 72, grade: "B" },
      { finalScore: 91, grade: "S" },
    ]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("전사 스코어 분포");
    expect(html).toContain("60 미만");
    expect(html).toContain("90+");
  });

  it("shows the histogram's empty state when nobody has a ScoreResult yet", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("전사 스코어 분포");
    expect(html).toContain("계산된 스코어가 아직 없습니다");
  });

  it("renders a per-team score comparison, bucketing people with no team under 미배정", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { finalScore: 80, grade: "A", person: { team: { name: "정산팀" } } },
      { finalScore: 84, grade: "A", person: { team: { name: "정산팀" } } },
      { finalScore: 60, grade: "C", person: { team: null } },
    ]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("팀별 성과 비교");
    expect(html).toContain("정산팀");
    expect(html).toContain("미배정");
  });

  it("uses the ?period= query param to query a different month instead of the current one", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(
      await DashboardPage({ searchParams: Promise.resolve({ period: "2026-03" }) })
    );

    expect(html).toContain("2026년 3월 요약");
    // This file has no beforeEach mock-history reset, so
    // mock.calls[0] would be a stale call from an earlier test —
    // .at(-2) is this test's own main query (the last call, at(-1),
    // is listAvailablePeriods' separate distinct-periods query).
    const call = mockPrisma.scoreResult.findMany.mock.calls.at(-2)![0];
    expect(call.where.periodStart).toEqual(new Date(Date.UTC(2026, 2, 1)));
  });

  it("shows the team chart's empty state when nobody has a ScoreResult yet", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("팀별 성과 비교");
  });
});

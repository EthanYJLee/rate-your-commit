import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreResult: { findMany: vi.fn() },
  identity: { count: vi.fn() },
  commit: { count: vi.fn() },
  person: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const mockAuth = vi.fn();
// Mocked for the same reason every other page/route test mocks
// "../auth": an unmocked `import ... from "next-auth"` fails to
// resolve "next/server" under Vitest — see credentials-sign-in.ts.
vi.mock("../auth", () => ({ auth: mockAuth }));

const { default: DashboardPage } = await import("../app/page");

describe("/ dashboard page", () => {
  // person.findMany feeds the S-01 burnout risk signal (per-person
  // commit timestamps) — every render calls it, so it needs a default
  // even in tests that don't care about risk alerts, or the page's
  // `for (const person of peopleWithCommits)` loop throws on
  // undefined. Same reasoning for the other three defaults.
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockPrisma.scoreResult.findMany.mockResolvedValue([]);
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.commit.count.mockResolvedValue(0);
    mockPrisma.person.findMany.mockResolvedValue([]);
  });

  it("shows a dash for average score when nobody has a ScoreResult yet", async () => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("—");
  });

  it("shows a '내 스코어카드' link when the signed-in AppUser is linked to a Person", async () => {
    mockAuth.mockResolvedValue({ user: { personId: "person-1" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('href="/scorecard/person-1"');
    expect(html).toContain("내 스코어카드");
  });

  it("does not show the '내 스코어카드' link when there's no linked person (GitHub sign-in, or an unlinked AppUser)", async () => {
    mockAuth.mockResolvedValue({ user: { login: "octocat" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).not.toContain("내 스코어카드");
  });

  it("computes the average score and grade distribution from ScoreResult rows", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { personId: "p1", finalScore: 90, grade: "S" },
      { personId: "p2", finalScore: 70, grade: "B" },
      { personId: "p3", finalScore: 80, grade: "A" },
    ]);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("80"); // (90+70+80)/3 = 80
    expect(html).toContain("미해결 아이덴티티 큐");
  });

  it("scopes the outlier-commit count to the current calendar month", async () => {
    await DashboardPage({ searchParams: Promise.resolve({}) });

    const call = mockPrisma.commit.count.mock.calls[0][0];
    expect(call.where.excludedFlag).toBe(true);
    expect(call.where.authoredAt.gte).toBeInstanceOf(Date);
    expect(call.where.authoredAt.lt.getTime()).toBeGreaterThan(call.where.authoredAt.gte.getTime());
  });

  it("links each stat to its source screen for an admin", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('href="/scorecard"');
    expect(html).toContain('href="/identities"');
  });

  it("does not link the identity-queue stat (or show the identities/settings hints) for a member", async () => {
    mockAuth.mockResolvedValue({ user: { role: "member" } });

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('href="/scorecard"');
    expect(html).not.toContain('href="/identities"');
    expect(html).not.toContain('href="/settings/weights"');
    expect(html).not.toContain('href="/settings/teams"');
  });

  it("renders the error message from the query param, when present (e.g. a member bounced off an admin-only page)", async () => {
    const html = renderToStaticMarkup(
      await DashboardPage({ searchParams: Promise.resolve({ error: "관리자 전용 페이지입니다." }) })
    );

    expect(html).toContain("관리자 전용 페이지입니다.");
  });

  it("renders a score-distribution histogram bucketed from finalScore", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { personId: "p1", finalScore: 55, grade: "C" },
      { personId: "p2", finalScore: 72, grade: "B" },
      { personId: "p3", finalScore: 91, grade: "S" },
    ]);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("전사 스코어 분포");
    expect(html).toContain("60 미만");
    expect(html).toContain("90+");
  });

  it("shows the histogram's empty state when nobody has a ScoreResult yet", async () => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("전사 스코어 분포");
    expect(html).toContain("계산된 스코어가 아직 없습니다");
  });

  it("renders a per-team score comparison, bucketing people with no team under 미배정", async () => {
    mockPrisma.scoreResult.findMany.mockResolvedValue([
      { personId: "p1", finalScore: 80, grade: "A", person: { team: { name: "정산팀" } } },
      { personId: "p2", finalScore: 84, grade: "A", person: { team: { name: "정산팀" } } },
      { personId: "p3", finalScore: 60, grade: "C", person: { team: null } },
    ]);

    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("팀별 성과 비교");
    expect(html).toContain("정산팀");
    expect(html).toContain("미배정");
  });

  it("uses the ?period= query param to query a different month instead of the current one", async () => {
    const html = renderToStaticMarkup(
      await DashboardPage({ searchParams: Promise.resolve({ period: "2026-03" }) })
    );

    expect(html).toContain("2026년 3월 요약");
    // beforeEach clears mocks per test, so [0] is reliably this
    // render's first scoreResult.findMany call (the current-period
    // query — see app/page.tsx's Promise.all ordering).
    const call = mockPrisma.scoreResult.findMany.mock.calls[0][0];
    expect(call.where.periodStart).toEqual(new Date(Date.UTC(2026, 2, 1)));
  });

  it("shows the team chart's empty state when nobody has a ScoreResult yet", async () => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("팀별 성과 비교");
  });

  describe("리스크 알림 (S-01)", () => {
    it("shows the empty state when no risk signals are detected", async () => {
      const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(html).toContain("리스크 신호가 감지된 인원이 없습니다");
    });

    it("flags a person whose score dropped significantly from the previous month", async () => {
      mockPrisma.scoreResult.findMany.mockImplementation(
        (args: { where?: { periodStart?: Date } }) => {
          // listAvailablePeriods' own distinct-periods query has no
          // where.periodStart at all (it filters by where.OR
          // instead) — only the current/previous-period queries do,
          // distinguished by comparing to "this month".
          const periodStart = args.where?.periodStart;
          if (!periodStart) return Promise.resolve([]);
          const isPrevious = periodStart.getUTCMonth() !== new Date().getUTCMonth();
          if (isPrevious) {
            return Promise.resolve([{ personId: "p1", finalScore: 85 }]);
          }
          return Promise.resolve([
            { personId: "p1", finalScore: 70, grade: "B", person: { displayName: "Alice", team: null } },
          ]);
        }
      );

      const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(html).toContain("Alice");
      expect(html).toContain("종합 스코어 급락");
      expect(html).toContain("85");
      expect(html).toContain("70");
    });

    it("flags a person whose commits this period are mostly at night/on weekends", async () => {
      mockPrisma.scoreResult.findMany.mockResolvedValue([
        { personId: "p1", finalScore: 90, grade: "S", person: { displayName: "Bob", team: null } },
      ]);
      mockPrisma.person.findMany.mockResolvedValue([
        {
          id: "p1",
          displayName: "Bob",
          identities: [
            {
              commits: [
                { authoredAt: new Date("2026-08-04T23:00:00Z") },
                { authoredAt: new Date("2026-08-05T23:30:00Z") },
              ],
            },
          ],
        },
      ]);

      const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(html).toContain("Bob");
      expect(html).toContain("번아웃 의심");
    });

    it("links a flagged person's name for an admin, but not for a member", async () => {
      mockAuth.mockResolvedValue({ user: { role: "admin" } });
      mockPrisma.scoreResult.findMany.mockResolvedValue([
        { personId: "p1", finalScore: 90, grade: "S", person: { displayName: "Carol", team: null } },
      ]);
      mockPrisma.person.findMany.mockResolvedValue([
        {
          id: "p1",
          displayName: "Carol",
          identities: [{ commits: [{ authoredAt: new Date("2026-08-04T23:00:00Z") }] }],
        },
      ]);

      const adminHtml = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
      expect(adminHtml).toContain('href="/scorecard/p1"');

      mockAuth.mockResolvedValue({ user: { role: "member" } });
      const memberHtml = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
      expect(memberHtml).not.toContain('href="/scorecard/p1"');
      expect(memberHtml).toContain("Carol");
    });
  });
});

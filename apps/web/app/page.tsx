import { prisma } from "@rateyourcommit/db";
import type { Grade } from "@rateyourcommit/scoring";
import { auth } from "../auth";
import { Histogram } from "../components/charts/Histogram";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { PeriodPicker } from "../components/PeriodPicker";
import { listAvailablePeriods } from "../lib/available-periods";
import { parsePeriodParam, periodLabel } from "../lib/period-param";
import { groupScoresByTeam } from "../lib/team-aggregation";

export const dynamic = "force-dynamic";

const GRADE_ORDER: Grade[] = ["S", "A", "B", "C", "D"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function StatCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
    </>
  );
  return href ? (
    <a href={href} className="card stat-card">
      {inner}
    </a>
  ) : (
    <div className="card stat-card">{inner}</div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; error?: string }>;
}) {
  const { period: periodParamValue, error } = await searchParams;
  const period = parsePeriodParam(periodParamValue);
  const session = await auth();
  // Set only for a Credentials (AppUser) sign-in an admin has linked
  // to a Person on /settings/app-users — convenience only, see
  // AppUser.personId's schema doc comment.
  const myPersonId = session?.user?.personId;
  // Gates the admin-only links below (UX only — proxy.ts is the real
  // enforcement, see lib/request-guard.ts). `error` is populated when
  // proxy.ts bounces a member away from an admin-only page they
  // followed a stale/typed link to.
  const isAdmin = session?.user?.role === "admin";

  const [scoreResults, pendingIdentityCount, outlierCommitCount, availablePeriods] =
    await Promise.all([
      prisma.scoreResult.findMany({
        where: { periodStart: period.start, periodEnd: period.end },
        include: { person: { select: { team: { select: { name: true } } } } },
      }),
      prisma.identity.count({ where: { personId: null } }),
      prisma.commit.count({
        where: { excludedFlag: true, authoredAt: { gte: period.start, lt: period.end } },
      }),
      listAvailablePeriods(),
    ]);

  const teamAverages = groupScoresByTeam(
    scoreResults.map((r) => ({ teamName: r.person?.team?.name ?? null, finalScore: r.finalScore })),
  );

  const averageScore =
    scoreResults.length > 0
      ? round1(scoreResults.reduce((sum, r) => sum + r.finalScore, 0) / scoreResults.length)
      : null;

  const gradeCounts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const result of scoreResults) {
    if (result.grade in gradeCounts) gradeCounts[result.grade as Grade] += 1;
  }

  return (
    <main className="page">
      <p className="eyebrow">S-01 · 대시보드</p>
      <h1 className="page-title">{periodLabel(period)} 요약</h1>
      <p className="page-subtitle">
        아래 세 지표는 S-07·S-04·S-02 화면의 데이터를 그대로 집계한 값입니다.
      </p>

      {error && <p className="error-banner">{error}</p>}

      <PeriodPicker action="/" selected={period} availablePeriods={availablePeriods} />

      {myPersonId && (
        <p className="hint">
          <a href={`/scorecard/${myPersonId}`}>내 스코어카드 바로가기 →</a>
        </p>
      )}

      <div className="stat-grid">
        <StatCard
          label={`${periodLabel(period)} 평균 점수`}
          value={averageScore !== null ? String(averageScore) : "—"}
          href="/scorecard"
        />
        <StatCard
          label="미해결 아이덴티티 큐"
          value={String(pendingIdentityCount)}
          href={isAdmin ? "/identities" : undefined}
        />
        <StatCard label={`${periodLabel(period)} LOC 이상치 커밋`} value={String(outlierCommitCount)} />
      </div>

      <h2 style={{ fontSize: "1.05rem", margin: "0 0 .8rem" }}>등급 분포</h2>
      <div className="grade-tally">
        {GRADE_ORDER.map((grade) => (
          <div key={grade} className="grade-tally__item">
            <p className="grade-tally__count">{gradeCounts[grade]}</p>
            <p className="grade-tally__label">{grade}등급</p>
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h2 className="chart-card__title">팀별 성과 비교</h2>
          {scoreResults.length === 0 ? (
            <p className="empty-state">
              {periodLabel(period)}에 계산된 스코어가 아직 없습니다. 데이터가 쌓이면 여기에 비교가 표시됩니다.
            </p>
          ) : (
            <HorizontalBarChart
              items={teamAverages.map((t) => ({ label: t.teamName, value: t.avgScore }))}
            />
          )}
        </div>
        <div className="card chart-card">
          <h2 className="chart-card__title">전사 스코어 분포</h2>
          {scoreResults.length === 0 ? (
            <p className="empty-state">
              {periodLabel(period)}에 계산된 스코어가 아직 없습니다. 데이터가 쌓이면 여기에 분포가 표시됩니다.
            </p>
          ) : (
            <Histogram scores={scoreResults.map((r) => r.finalScore)} />
          )}
        </div>
      </div>

      <p className="hint">
        지금 실제로 동작하는 화면은{" "}
        {isAdmin && (
          <>
            <a href="/identities">아이덴티티 매핑 큐(S-07)</a>,{" "}
          </>
        )}
        <a href="/scorecard">개인 스코어카드(S-02)</a>
        {isAdmin && (
          <>
            , <a href="/settings/weights">축 가중치 설정</a>,{" "}
            <a href="/settings/teams">팀 설정</a>
          </>
        )}
        입니다. 자세한 내용은 <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>
    </main>
  );
}

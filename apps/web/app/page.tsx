import { prisma } from "@rateyourcommit/db";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import type { Grade } from "@rateyourcommit/scoring";

export const dynamic = "force-dynamic";

const GRADE_ORDER: Grade[] = ["S", "A", "B", "C", "D"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function StatCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const card = (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "1.2rem",
        flex: "1 1 0",
        minWidth: 160,
      }}
    >
      <p style={{ color: "var(--ink-soft)", fontSize: ".8rem", marginBottom: ".4rem" }}>{label}</p>
      <p style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{value}</p>
    </div>
  );
  return href ? (
    <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", flex: "1 1 0" }}>
      {card}
    </a>
  ) : (
    card
  );
}

export default async function DashboardPage() {
  const period = currentMonthPeriod();

  const [scoreResults, pendingIdentityCount, outlierCommitCount] = await Promise.all([
    prisma.scoreResult.findMany({ where: { periodStart: period.start, periodEnd: period.end } }),
    prisma.identity.count({ where: { personId: null } }),
    prisma.commit.count({
      where: { excludedFlag: true, authoredAt: { gte: period.start, lt: period.end } },
    }),
  ]);

  const averageScore =
    scoreResults.length > 0
      ? round1(scoreResults.reduce((sum, r) => sum + r.finalScore, 0) / scoreResults.length)
      : null;

  const gradeCounts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const result of scoreResults) {
    if (result.grade in gradeCounts) gradeCounts[result.grade as Grade] += 1;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: ".75rem",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 700,
        }}
      >
        S-01 · 대시보드 · RateYourCommit v0.0.1
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: ".5rem" }}>
        {period.start.getUTCFullYear()}년 {period.start.getUTCMonth() + 1}월 요약
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem" }}>
        아래 세 지표는 S-07·S-04·S-02 화면의 데이터를 그대로 집계한 값입니다.
      </p>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <StatCard
          label="이번 달 평균 점수"
          value={averageScore !== null ? String(averageScore) : "—"}
          href="/scorecard"
        />
        <StatCard label="미해결 아이덴티티 큐" value={String(pendingIdentityCount)} href="/identities" />
        <StatCard label="이번 달 LOC 이상치 커밋" value={String(outlierCommitCount)} />
      </div>

      <h2 style={{ fontSize: "1.1rem", marginBottom: ".8rem" }}>등급 분포</h2>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2.5rem", flexWrap: "wrap" }}>
        {GRADE_ORDER.map((grade) => (
          <div key={grade} style={{ textAlign: "center" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
              {gradeCounts[grade]}
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: ".8rem" }}>{grade}등급</p>
          </div>
        ))}
      </div>

      <p style={{ color: "var(--ink-soft)" }}>
        지금 실제로 동작하는 화면은 <a href="/identities">아이덴티티 매핑 큐(S-07)</a>,{" "}
        <a href="/scorecard">개인 스코어카드(S-02)</a>,{" "}
        <a href="/settings/weights">축 가중치 설정</a> 셋입니다. 자세한 내용은{" "}
        <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>
    </main>
  );
}

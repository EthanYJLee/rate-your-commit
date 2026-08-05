import { prisma } from "@rateyourcommit/db";
import { currentMonthPeriod } from "@rateyourcommit/metrics";

export const dynamic = "force-dynamic";

const AXIS_LABEL = {
  delivery: "딜리버리",
  quality: "품질",
  collaboration: "협업",
  evaluation: "동료평가",
} as const;

function formatPeriodLabel(start: Date): string {
  return `${start.getUTCFullYear()}년 ${start.getUTCMonth() + 1}월`;
}

export default async function ScorecardPage() {
  const period = currentMonthPeriod();

  const results = await prisma.scoreResult.findMany({
    where: { periodStart: period.start, periodEnd: period.end },
    include: { person: true },
    orderBy: { finalScore: "desc" },
  });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.5rem" }}>
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
        S-02 · 개인 스코어카드
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: ".5rem" }}>
        {formatPeriodLabel(period.start)} 스코어
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1rem" }}>
        총 {results.length}명 · DB에서 실시간 조회
      </p>
      <p style={{ color: "var(--ink-soft)", fontSize: ".85rem", marginBottom: "2rem" }}>
        {AXIS_LABEL.collaboration}·{AXIS_LABEL.evaluation} 축은 아직 v1에 구현되지 않아
        가중치 0으로 계산에 반영되지 않습니다 (참고용 표시). 자세한 내용은{" "}
        <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>

      {results.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>
          이번 달 계산된 스코어가 아직 없습니다. <code>apps/worker</code>가 최소 한 번
          동기화를 완료하고, S-07에서 identity가 Person으로 병합돼야 스코어가 계산됩니다.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: ".6rem" }}>이름</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>{AXIS_LABEL.delivery}</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>{AXIS_LABEL.quality}</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>{AXIS_LABEL.collaboration}</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>{AXIS_LABEL.evaluation}</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>최종 점수</th>
              <th style={{ padding: ".6rem", textAlign: "center" }}>등급</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: ".6rem" }}>{result.person.displayName}</td>
                <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                  {result.delivery}
                </td>
                <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                  {result.quality}
                </td>
                <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace", color: "var(--ink-soft)" }}>
                  {result.collaboration}
                </td>
                <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace", color: "var(--ink-soft)" }}>
                  {result.evaluation}
                </td>
                <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                  {result.finalScore}
                </td>
                <td style={{ padding: ".6rem", textAlign: "center", fontWeight: 700 }}>{result.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

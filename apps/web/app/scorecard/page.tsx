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
    <main className="page">
      <p className="eyebrow">S-02 · 개인 스코어카드</p>
      <h1 className="page-title">{formatPeriodLabel(period.start)} 스코어</h1>
      <p className="page-subtitle" style={{ marginBottom: ".5rem" }}>
        총 {results.length}명 · DB에서 실시간 조회
      </p>
      <p className="hint" style={{ marginBottom: "1.75rem" }}>
        {AXIS_LABEL.collaboration}·{AXIS_LABEL.evaluation} 축은 아직 v1에 구현되지 않아
        가중치 0으로 계산에 반영되지 않습니다 (참고용 표시). 자세한 내용은{" "}
        <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>

      {results.length === 0 ? (
        <p className="empty-state">
          이번 달 계산된 스코어가 아직 없습니다. <code>apps/worker</code>가 최소 한 번
          동기화를 완료하고, S-07에서 identity가 Person으로 병합돼야 스코어가 계산됩니다.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th className="num">{AXIS_LABEL.delivery}</th>
              <th className="num">{AXIS_LABEL.quality}</th>
              <th className="num">{AXIS_LABEL.collaboration}</th>
              <th className="num">{AXIS_LABEL.evaluation}</th>
              <th className="num">최종 점수</th>
              <th className="center">등급</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{result.person.displayName}</td>
                <td className="num">{result.delivery}</td>
                <td className="num">{result.quality}</td>
                <td className="num" style={{ color: "var(--ink-faint)" }}>
                  {result.collaboration}
                </td>
                <td className="num" style={{ color: "var(--ink-faint)" }}>
                  {result.evaluation}
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {result.finalScore}
                </td>
                <td className="center">
                  <span className={`badge badge--grade-${result.grade}`}>{result.grade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

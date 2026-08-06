import { prisma } from "@rateyourcommit/db";
import { PeriodPicker } from "../../components/PeriodPicker";
import { listAvailablePeriods } from "../../lib/available-periods";
import { parsePeriodParam, periodLabel } from "../../lib/period-param";

export const dynamic = "force-dynamic";

const AXIS_LABEL = {
  delivery: "딜리버리",
  quality: "품질",
  collaboration: "협업",
  evaluation: "동료평가",
} as const;

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParamValue } = await searchParams;
  const period = parsePeriodParam(periodParamValue);

  const [results, pendingIdentityCount, availablePeriods] = await Promise.all([
    prisma.scoreResult.findMany({
      where: { periodStart: period.start, periodEnd: period.end },
      include: { person: true },
      orderBy: { finalScore: "desc" },
    }),
    prisma.identity.count({ where: { personId: null } }),
    listAvailablePeriods(),
  ]);

  return (
    <main className="page">
      <p className="eyebrow">S-02 · 개인 스코어카드</p>
      <h1 className="page-title">{periodLabel(period)} 스코어</h1>
      <p className="page-subtitle" style={{ marginBottom: ".5rem" }}>
        총 {results.length}명 · DB에서 실시간 조회
      </p>

      <PeriodPicker action="/scorecard" selected={period} availablePeriods={availablePeriods} />

      {pendingIdentityCount > 0 && (
        <p className="warning-banner">
          ⚠ 미해결 아이덴티티가 {pendingIdentityCount}개 있습니다. 이 사람들의 커밋/티켓은
          어떤 Person에도 집계되지 않아, 아래 스코어에 반영되지 않았을 수 있습니다.{" "}
          <a href="/identities">아이덴티티 매핑에서 확인하기 →</a>
        </p>
      )}

      <p className="hint" style={{ marginBottom: "1.75rem" }}>
        {AXIS_LABEL.collaboration}·{AXIS_LABEL.evaluation} 축은 아직 v1에 구현되지 않아
        가중치 0으로 계산에 반영되지 않습니다 (참고용 표시). 자세한 내용은{" "}
        <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>

      {results.length === 0 ? (
        <p className="empty-state">
          {periodLabel(period)}에 계산된 스코어가 아직 없습니다. <code>apps/worker</code>가
          해당 기간에 최소 한 번 동기화를 완료하고, S-07에서 identity가 Person으로
          병합돼야 스코어가 계산됩니다.
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
                <td>
                  <a href={`/scorecard/${result.personId}`}>{result.person.displayName}</a>
                </td>
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

import { prisma } from "@rateyourcommit/db";
import { auth } from "../../auth";
import { PeriodPicker } from "../../components/PeriodPicker";
import { listAvailablePeriods } from "../../lib/available-periods";
import { parsePeriodParam, periodLabel, periodParam } from "../../lib/period-param";

function formatConfirmedAt(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export const dynamic = "force-dynamic";

const AXIS_LABEL = {
  delivery: "딜리버리",
  quality: "품질",
  collaboration: "협업",
  evaluation: "동료평가",
} as const;

/**
 * Formats the reference-only raw-activity columns (see ScoreResult's
 * schema doc comment) — plain counts, never part of finalScore.
 * "-" for zero activity rather than "0 (이상치 0)", to keep the common
 * case (nothing to flag) visually quiet.
 */
function formatCommitCount(commitCount: number, excludedCommitCount: number): string {
  if (commitCount === 0) return "-";
  return excludedCommitCount > 0 ? `${commitCount} (이상치 ${excludedCommitCount})` : String(commitCount);
}

function formatTicketCount(ticketCount: number, closedTicketCount: number): string {
  if (ticketCount === 0) return "-";
  return `${ticketCount} (완료 ${closedTicketCount})`;
}

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; error?: string }>;
}) {
  const { period: periodParamValue, error } = await searchParams;
  const period = parsePeriodParam(periodParamValue);

  const [results, pendingIdentityCount, availablePeriods, confirmation, session] =
    await Promise.all([
      prisma.scoreResult.findMany({
        where: { periodStart: period.start, periodEnd: period.end },
        include: { person: true },
        orderBy: { finalScore: "desc" },
      }),
      prisma.identity.count({ where: { personId: null } }),
      listAvailablePeriods(),
      prisma.scoreConfirmation.findUnique({
        where: { periodStart_periodEnd: { periodStart: period.start, periodEnd: period.end } },
      }),
      auth(),
    ]);
  const isAdmin = session?.user?.role === "admin";

  return (
    <main className="page">
      <p className="eyebrow">S-02 · 개인 스코어카드</p>
      <h1 className="page-title">{periodLabel(period)} 스코어</h1>
      <p className="page-subtitle" style={{ marginBottom: ".5rem" }}>
        총 {results.length}명 · DB에서 실시간 조회
      </p>

      <PeriodPicker action="/scorecard" selected={period} availablePeriods={availablePeriods} />

      {error && <p className="error-banner">{error}</p>}

      {confirmation ? (
        <p className="hint" style={{ marginBottom: "1rem" }}>
          <span className="badge badge--neutral">확정됨</span>{" "}
          {confirmation.confirmedByLogin} · {formatConfirmedAt(confirmation.confirmedAt)}
        </p>
      ) : (
        isAdmin && (
          <form
            action="/api/scorecard/confirm"
            method="POST"
            className="field-row"
            style={{ marginBottom: "1rem" }}
          >
            <input type="hidden" name="period" value={periodParam(period)} />
            <button
              type="submit"
              className="button button--small"
              disabled={pendingIdentityCount > 0}
              title={
                pendingIdentityCount > 0
                  ? "미해결 아이덴티티가 있어 확정할 수 없습니다"
                  : undefined
              }
            >
              {periodLabel(period)} 확정
            </button>
            {pendingIdentityCount > 0 && (
              <span className="hint">미해결 아이덴티티 {pendingIdentityCount}개로 인해 확정 불가</span>
            )}
          </form>
        )
      )}

      {pendingIdentityCount > 0 && (
        <p className="warning-banner">
          ⚠ 미해결 아이덴티티가 {pendingIdentityCount}개 있습니다. 이 사람들의 커밋/티켓은
          어떤 Person에도 집계되지 않아, 아래 스코어에 반영되지 않았을 수 있습니다.{" "}
          <a href="/identities">아이덴티티 매핑에서 확인하기 →</a>
        </p>
      )}

      <p className="hint" style={{ marginBottom: "1.75rem" }}>
        {AXIS_LABEL.collaboration}·{AXIS_LABEL.evaluation} 축은 아직 v1에 구현되지 않아
        가중치 0으로 계산에 반영되지 않습니다 (참고용 표시). 커밋 수·티켓 수도 점수 계산에는
        반영되지 않는 원시 활동량 참고 정보입니다. 자세한 내용은{" "}
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
              <th className="num">커밋 수</th>
              <th className="num">티켓 수</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>
                  <a href={`/scorecard/${result.personId}?period=${periodParam(period)}`}>
                    {result.person.displayName}
                  </a>
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
                <td className="num" style={{ color: "var(--ink-faint)" }}>
                  {formatCommitCount(result.commitCount, result.excludedCommitCount)}
                </td>
                <td className="num" style={{ color: "var(--ink-faint)" }}>
                  {formatTicketCount(result.ticketCount, result.closedTicketCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

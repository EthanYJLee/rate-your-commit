import { notFound } from "next/navigation";
import { prisma } from "@rateyourcommit/db";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import { GaugeChart } from "../../../components/charts/GaugeChart";
import { RadarChart } from "../../../components/charts/RadarChart";
import { TrendLineChart } from "../../../components/charts/TrendLineChart";
import { round1 } from "../../../lib/chart-math";

export const dynamic = "force-dynamic";

const AXIS_LABELS: [string, string, string, string] = ["딜리버리", "품질", "협업", "평가"];
const TREND_MONTHS = 6;
const MIN_TREND_POINTS = 2;

interface AxisRow {
  delivery: number;
  quality: number;
  collaboration: number;
  evaluation: number;
}

function averageAxis(rows: AxisRow[], key: keyof AxisRow): number {
  if (rows.length === 0) return 0;
  return round1(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
}

function formatMonthLabel(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}.${mm}`;
}

export default async function ScorecardDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const period = currentMonthPeriod();

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) notFound();

  const [ownResult, periodResults, trendResults] = await Promise.all([
    prisma.scoreResult.findUnique({
      where: {
        personId_periodStart_periodEnd: {
          personId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
    // Everyone's ScoreResult this period, to derive the radar's "전사
    // 평균" comparison line — there's no Team model yet, so this
    // stands in for the original 화면설계서's "팀 평균" axis.
    prisma.scoreResult.findMany({
      where: { periodStart: period.start, periodEnd: period.end },
    }),
    // Most recent months for this person, newest first; reversed below
    // for chronological (oldest→newest) display.
    prisma.scoreResult.findMany({
      where: { personId },
      orderBy: { periodStart: "desc" },
      take: TREND_MONTHS,
    }),
  ]);

  const trendEntries = trendResults
    .slice()
    .reverse()
    .map((result) => ({ label: formatMonthLabel(result.periodStart), score: result.finalScore }));

  return (
    <main className="page">
      <p className="hint" style={{ marginBottom: ".3rem" }}>
        <a href="/scorecard">← 전체 스코어카드로</a>
      </p>
      <p className="eyebrow">S-02 · 개인 성과 스코어카드</p>
      <h1 className="page-title">
        {person.displayName}
        {person.employeeId && (
          <span
            style={{
              color: "var(--ink-faint)",
              fontWeight: 400,
              fontSize: "1rem",
              marginLeft: ".6rem",
            }}
          >
            {person.employeeId}
          </span>
        )}
      </h1>

      {!ownResult ? (
        <p className="empty-state">
          이번 달 계산된 스코어가 아직 없습니다. <code>apps/worker</code>가 이번 달 동기화를
          완료하면 표시됩니다.
        </p>
      ) : (
        <div className="chart-grid">
          <div className="card chart-card" style={{ textAlign: "center" }}>
            <h2 className="chart-card__title">종합 스코어</h2>
            <GaugeChart percent={ownResult.finalScore} />
            <div style={{ marginTop: ".6rem" }}>
              <span className={`badge badge--grade-${ownResult.grade}`}>등급 {ownResult.grade}</span>
            </div>
          </div>
          <div className="card chart-card">
            <h2 className="chart-card__title">4대 축 — 본인 vs 전사 평균</h2>
            <RadarChart
              axisLabels={AXIS_LABELS}
              series={[
                {
                  label: "본인",
                  values: [
                    ownResult.delivery,
                    ownResult.quality,
                    ownResult.collaboration,
                    ownResult.evaluation,
                  ],
                  color: "var(--accent)",
                },
                {
                  label: "전사 평균",
                  values: [
                    averageAxis(periodResults, "delivery"),
                    averageAxis(periodResults, "quality"),
                    averageAxis(periodResults, "collaboration"),
                    averageAxis(periodResults, "evaluation"),
                  ],
                  color: "var(--ink-faint)",
                  dashed: true,
                },
              ]}
            />
          </div>
        </div>
      )}

      <div className="card chart-card">
        <h2 className="chart-card__title">월별 스코어 추이</h2>
        {trendEntries.length < MIN_TREND_POINTS ? (
          <p className="empty-state">
            추이를 보기엔 데이터가 부족합니다. 최소 {MIN_TREND_POINTS}개월치 스코어가 필요합니다.
          </p>
        ) : (
          <TrendLineChart entries={trendEntries} />
        )}
      </div>
    </main>
  );
}

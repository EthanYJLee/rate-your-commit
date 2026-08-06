export interface HorizontalBarChartItem {
  label: string;
  /** 0-100 score, used directly as the bar's fill percentage. */
  value: number;
}

/**
 * Static horizontal bar comparison (S-01 팀별 성과 비교) — plain CSS
 * bars, not SVG, same as Histogram: matches how the original
 * 화면설계서 draws this chart (percentage-width divs, not a real
 * chart lib). No click/drill-down — S-03 (the original design's
 * drill-down target) isn't in scope.
 */
export function HorizontalBarChart({ items }: { items: HorizontalBarChartItem[] }) {
  return (
    <div className="hbar-chart">
      {items.map((item) => (
        <div key={item.label} className="hbar-chart__row">
          <span className="hbar-chart__label">{item.label}</span>
          <div className="hbar-chart__track">
            <div
              className="hbar-chart__fill"
              style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
            />
          </div>
          <span className="hbar-chart__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

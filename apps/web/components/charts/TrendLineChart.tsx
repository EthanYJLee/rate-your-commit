import { trendLinePoints, type TrendEntry } from "../../lib/chart-math";

const BOTTOM_Y = 110;

/**
 * Monthly score trend line. Callers are expected to only render this
 * with 2+ entries — a single point can't show a trend, so the caller
 * should fall back to an empty-state message instead (same pattern as
 * the rest of the app's "not enough data yet" screens).
 */
export function TrendLineChart({ entries }: { entries: TrendEntry[] }) {
  const points = trendLinePoints(entries);
  if (points.length < 2) return null;

  const last = points[points.length - 1];
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${points[0].x},${BOTTOM_Y} ${points
    .map((p) => `L${p.x},${p.y}`)
    .join(" ")} L${last.x},${BOTTOM_Y} Z`;

  return (
    <svg viewBox="0 0 300 130" width="100%" height="120">
      <line x1={20} y1={20} x2={290} y2={20} stroke="var(--line)" strokeWidth={1} />
      <line x1={20} y1={65} x2={290} y2={65} stroke="var(--line)" strokeWidth={1} />
      <line x1={20} y1={BOTTOM_Y} x2={290} y2={BOTTOM_Y} stroke="var(--line-strong)" strokeWidth={1} />
      <path d={areaPath} fill="var(--accent)" fillOpacity={0.12} />
      <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={isLast ? 5 : 3}
            fill="var(--accent)"
            stroke={isLast ? "var(--surface)" : undefined}
            strokeWidth={isLast ? 2 : 0}
          />
        );
      })}
      <text x={last.x} y={last.y - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--ink)">
        {last.score}
      </text>
      {points.map((p) => (
        <text key={`label-${p.label}`} x={p.x} y={122} textAnchor="middle" fontSize={8} fill="var(--ink-faint)">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

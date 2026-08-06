import { pointsToSvgString, radarPolygonPoints } from "../../lib/chart-math";

export interface RadarSeries {
  label: string;
  /** [delivery, quality, collaboration, evaluation], 0-100 each. */
  values: [number, number, number, number];
  color: string;
  dashed?: boolean;
}

const CENTER = 100;
const MAX_RADIUS = 80;
const GRID_RING_STEPS = [1, 2, 3];

// Top / right / bottom / left label anchors — matches the 화면설계서
// layout exactly (see radarPolygonPoints doc comment for the axis order).
const AXIS_LABEL_POS: Array<{ x: number; y: number; anchor: "start" | "middle" | "end" }> = [
  { x: CENTER, y: CENTER - MAX_RADIUS - 8, anchor: "middle" },
  { x: CENTER + MAX_RADIUS + 8, y: CENTER + 3, anchor: "start" },
  { x: CENTER, y: CENTER + MAX_RADIUS + 16, anchor: "middle" },
  { x: CENTER - MAX_RADIUS - 8, y: CENTER + 3, anchor: "end" },
];

/** 4-axis radar comparing one or more series (e.g. 본인 vs 전사 평균). */
export function RadarChart({
  axisLabels,
  series,
}: {
  axisLabels: [string, string, string, string];
  series: RadarSeries[];
}) {
  const gridRings = GRID_RING_STEPS.map((step) =>
    pointsToSvgString(
      radarPolygonPoints(
        [1, 1, 1, 1].map(() => (step / GRID_RING_STEPS.length) * 100),
        { center: CENTER, maxRadius: MAX_RADIUS },
      ),
    ),
  );

  return (
    <div className="radar-chart">
      <svg viewBox="0 0 200 200" width="100%" height="180">
        {gridRings.map((ring, i) => (
          <polygon key={i} points={ring} fill="none" stroke="var(--line)" strokeWidth={1} />
        ))}
        {series.map((s) => (
          <polygon
            key={s.label}
            points={pointsToSvgString(
              radarPolygonPoints(s.values, { center: CENTER, maxRadius: MAX_RADIUS }),
            )}
            fill={s.color}
            fillOpacity={0.15}
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? "3 2" : undefined}
          />
        ))}
        {axisLabels.map((label, i) => (
          <text
            key={label}
            x={AXIS_LABEL_POS[i].x}
            y={AXIS_LABEL_POS[i].y}
            textAnchor={AXIS_LABEL_POS[i].anchor}
            fontSize={9}
            fill="var(--ink-faint)"
          >
            {label} {series[0]?.values[i]}
          </text>
        ))}
      </svg>
      <div className="radar-chart__legend">
        {series.map((s) => (
          <span key={s.label} className="radar-chart__legend-item">
            <span className="radar-chart__legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

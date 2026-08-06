import { gaugeArc } from "../../lib/chart-math";

/** Circular progress ring for a single 0-100 score (S-02 종합 스코어). */
export function GaugeChart({ percent, size = 112 }: { percent: number; size?: number }) {
  const { circumference, filledLength } = gaugeArc(percent);

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="gauge__svg">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth={10} />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${circumference}`}
        />
      </svg>
      <div className="gauge__center">
        <span className="gauge__value">{percent}</span>
        <span className="gauge__sub">/ 100</span>
      </div>
    </div>
  );
}

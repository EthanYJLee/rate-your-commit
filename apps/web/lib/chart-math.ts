/**
 * Pure geometry/aggregation helpers for the SVG charts on S-01/S-02
 * (score gauge, 4-axis radar, monthly trend line, score-distribution
 * histogram). Deliberately separate from any rendering — these are
 * presentation math only, not scoring math, so they live in apps/web
 * rather than packages/scoring (see docs/AI-POLICY.md for why scoring
 * math is kept pure and isolated; this file has nothing to do with
 * that boundary, it just draws pictures of numbers that already exist).
 */

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// ---- Gauge (S-02 종합 스코어) ----

export interface GaugeArc {
  radius: number;
  circumference: number;
  /** Length (in the same units as circumference) of the filled arc segment. */
  filledLength: number;
}

export function gaugeArc(percent: number, radius = 42): GaugeArc {
  const circumference = 2 * Math.PI * radius;
  const filledLength = (circumference * clampPercent(percent)) / 100;
  return { radius, circumference: round1(circumference), filledLength: round1(filledLength) };
}

// ---- Radar (S-02 4대 축) ----

export interface Point {
  x: number;
  y: number;
}

/**
 * Places `values` (0-100 each) evenly around a circle starting at the
 * top and going clockwise, scaled from `center` out to `maxRadius`.
 * With 4 values this reproduces the 화면설계서 layout exactly: axis 0
 * top, axis 1 right, axis 2 bottom, axis 3 left.
 */
export function radarPolygonPoints(
  values: number[],
  { center = 100, maxRadius = 80 }: { center?: number; maxRadius?: number } = {},
): Point[] {
  const n = values.length;
  return values.map((value, i) => {
    const r = (maxRadius * clampPercent(value)) / 100;
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return {
      x: round1(center + r * Math.cos(angle)),
      y: round1(center + r * Math.sin(angle)),
    };
  });
}

export function pointsToSvgString(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

// ---- Trend line (S-02 월별 스코어 추이) ----

export interface TrendEntry {
  label: string;
  score: number;
}

export interface TrendPoint extends Point {
  label: string;
  score: number;
}

export interface TrendLineOptions {
  width?: number;
  top?: number;
  bottom?: number;
  leftPad?: number;
  rightPad?: number;
}

/**
 * Lays out `entries` (already in chronological order) left-to-right at
 * even spacing, scaling score 0-100 linearly onto the [top, bottom] y
 * range (fixed 0-100 domain, not auto-scaled to the visible data — a
 * trend line should not visually exaggerate small swings).
 */
export function trendLinePoints(
  entries: TrendEntry[],
  { width = 300, top = 20, bottom = 110, leftPad = 30, rightPad = 30 }: TrendLineOptions = {},
): TrendPoint[] {
  const n = entries.length;
  if (n === 0) return [];
  const usableWidth = width - leftPad - rightPad;
  const step = n > 1 ? usableWidth / (n - 1) : 0;
  return entries.map((entry, i) => {
    const x = round1(leftPad + step * i);
    const y = round1(bottom - (clampPercent(entry.score) / 100) * (bottom - top));
    return { x, y, label: entry.label, score: entry.score };
  });
}

// ---- Histogram (S-01 전사 스코어 분포) ----

export interface HistogramBucket {
  label: string;
  count: number;
}

const HISTOGRAM_BUCKET_RANGES: Array<{ label: string; min: number; max: number }> = [
  { label: "60 미만", min: -Infinity, max: 60 },
  { label: "60대", min: 60, max: 70 },
  { label: "70대", min: 70, max: 80 },
  { label: "80대", min: 80, max: 90 },
  { label: "90+", min: 90, max: Infinity },
];

export function histogramBuckets(scores: number[]): HistogramBucket[] {
  return HISTOGRAM_BUCKET_RANGES.map(({ label, min, max }) => ({
    label,
    count: scores.filter((score) => score >= min && score < max).length,
  }));
}

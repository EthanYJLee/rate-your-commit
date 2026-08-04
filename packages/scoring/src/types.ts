/**
 * Per-axis metric values, each on a 0-100 scale, already normalized
 * upstream (packages/connectors + apps/worker). This package never
 * touches raw commit/ticket data — only these four numbers.
 */
export interface AxisMetrics {
  delivery: number;
  quality: number;
  collaboration: number;
  evaluation: number;
}

/**
 * Organization-configured weights for the four axes. Must sum to 100.
 * Validated by calculateScore — never hardcoded, always sourced from
 * ScoreWeightConfig (see docs/ARCHITECTURE.md §3).
 */
export interface AxisWeights {
  delivery: number;
  quality: number;
  collaboration: number;
  evaluation: number;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

/**
 * Minimum score (inclusive) required for each grade, evaluated in
 * descending order. Must cover the full 0-100 range without gaps.
 */
export type GradeThresholds = Record<Grade, number>;

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = {
  S: 90,
  A: 80,
  B: 65,
  C: 50,
  D: 0,
};

const GRADE_ORDER: Grade[] = ["S", "A", "B", "C", "D"];

export function gradesByDescendingThreshold(
  thresholds: GradeThresholds
): Grade[] {
  return [...GRADE_ORDER].sort((a, b) => thresholds[b] - thresholds[a]);
}

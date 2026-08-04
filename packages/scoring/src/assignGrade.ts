import {
  DEFAULT_GRADE_THRESHOLDS,
  gradesByDescendingThreshold,
  type Grade,
  type GradeThresholds,
} from "./types";

/**
 * Maps a 0-100 score to a letter grade using threshold cutoffs.
 * Pure function — no distribution curve-fitting, no ML classifier.
 * Thresholds are organization-configurable; defaults are illustrative.
 */
export function assignGrade(
  score: number,
  thresholds: GradeThresholds = DEFAULT_GRADE_THRESHOLDS
): Grade {
  const ordered = gradesByDescendingThreshold(thresholds);
  for (const grade of ordered) {
    if (score >= thresholds[grade]) {
      return grade;
    }
  }
  // Only reachable if thresholds don't cover 0 — fall back to the lowest grade.
  return ordered[ordered.length - 1];
}

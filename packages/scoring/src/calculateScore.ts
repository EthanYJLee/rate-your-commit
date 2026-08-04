import type { AxisMetrics, AxisWeights } from "./types";

const WEIGHT_SUM_TOLERANCE = 0.01;

export class InvalidWeightsError extends Error {
  constructor(sum: number) {
    super(
      `Axis weights must sum to 100, got ${sum}. Fix the organization's ScoreWeightConfig.`
    );
    this.name = "InvalidWeightsError";
  }
}

function sumWeights(weights: AxisWeights): number {
  return (
    weights.delivery +
    weights.quality +
    weights.collaboration +
    weights.evaluation
  );
}

/**
 * Weighted sum of the four axis metrics. Pure function: same inputs
 * always produce the same output, no I/O, no AI, no hidden state.
 *
 * This is the calculation a manager should be able to redo by hand
 * with a calculator to answer "why did I get this score" — keep it
 * that simple. See docs/AI-POLICY.md for why this constraint exists.
 */
export function calculateScore(
  metrics: AxisMetrics,
  weights: AxisWeights
): number {
  const weightSum = sumWeights(weights);
  if (Math.abs(weightSum - 100) > WEIGHT_SUM_TOLERANCE) {
    throw new InvalidWeightsError(weightSum);
  }

  const raw =
    metrics.delivery * (weights.delivery / 100) +
    metrics.quality * (weights.quality / 100) +
    metrics.collaboration * (weights.collaboration / 100) +
    metrics.evaluation * (weights.evaluation / 100);

  return Math.round(raw * 10) / 10;
}

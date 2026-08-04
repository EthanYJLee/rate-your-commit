import { describe, expect, it } from "vitest";
import {
  calculateScore,
  InvalidWeightsError,
  assignGrade,
  DEFAULT_GRADE_THRESHOLDS,
} from "../src/index";

describe("calculateScore", () => {
  it("computes a weighted sum matching hand calculation", () => {
    const score = calculateScore(
      { delivery: 88, quality: 74, collaboration: 80, evaluation: 91 },
      { delivery: 35, quality: 25, collaboration: 20, evaluation: 20 }
    );
    // 88*.35 + 74*.25 + 80*.20 + 91*.20 = 30.8 + 18.5 + 16 + 18.2 = 83.5
    expect(score).toBe(83.5);
  });

  it("returns 100 when all metrics are perfect regardless of weight split", () => {
    const score = calculateScore(
      { delivery: 100, quality: 100, collaboration: 100, evaluation: 100 },
      { delivery: 10, quality: 20, collaboration: 30, evaluation: 40 }
    );
    expect(score).toBe(100);
  });

  it("returns 0 when all metrics are 0", () => {
    const score = calculateScore(
      { delivery: 0, quality: 0, collaboration: 0, evaluation: 0 },
      { delivery: 35, quality: 25, collaboration: 20, evaluation: 20 }
    );
    expect(score).toBe(0);
  });

  it("throws InvalidWeightsError when weights do not sum to 100", () => {
    expect(() =>
      calculateScore(
        { delivery: 50, quality: 50, collaboration: 50, evaluation: 50 },
        { delivery: 30, quality: 30, collaboration: 30, evaluation: 30 }
      )
    ).toThrow(InvalidWeightsError);
  });

  it("tolerates floating point rounding in weights (e.g. 33.33 x 3 + 0.01)", () => {
    expect(() =>
      calculateScore(
        { delivery: 50, quality: 50, collaboration: 0, evaluation: 0 },
        { delivery: 33.33, quality: 33.33, collaboration: 33.33, evaluation: 0.01 }
      )
    ).not.toThrow();
  });
});

describe("assignGrade", () => {
  it("assigns grades at exact threshold boundaries using defaults", () => {
    expect(assignGrade(90)).toBe("S");
    expect(assignGrade(89.9)).toBe("A");
    expect(assignGrade(80)).toBe("A");
    expect(assignGrade(65)).toBe("B");
    expect(assignGrade(50)).toBe("C");
    expect(assignGrade(49.9)).toBe("D");
    expect(assignGrade(0)).toBe("D");
  });

  it("respects custom organization-defined thresholds", () => {
    const strict = { S: 95, A: 85, B: 70, C: 55, D: 0 };
    expect(assignGrade(92, strict)).toBe("A");
    expect(assignGrade(96, strict)).toBe("S");
  });

  it("uses DEFAULT_GRADE_THRESHOLDS when no thresholds are passed", () => {
    expect(assignGrade(83.5)).toBe(assignGrade(83.5, DEFAULT_GRADE_THRESHOLDS));
  });
});

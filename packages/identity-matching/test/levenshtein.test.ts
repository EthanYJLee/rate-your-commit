import { describe, expect, it } from "vitest";
import { handleSimilarityPercent, levenshteinDistance } from "../src/levenshtein";

describe("levenshteinDistance", () => {
  it("is 0 for identical strings", () => {
    expect(levenshteinDistance("alice", "alice")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(levenshteinDistance("cat", "bat")).toBe(1);
  });

  it("counts insertions/deletions for different lengths", () => {
    expect(levenshteinDistance("jsmith", "jsmith88")).toBe(2);
  });
});

describe("handleSimilarityPercent", () => {
  it("is 100 for identical strings (case-insensitive)", () => {
    expect(handleSimilarityPercent("Alice", "alice")).toBe(100);
  });

  it("is 100 for two empty strings", () => {
    expect(handleSimilarityPercent("", "")).toBe(100);
  });

  it("scores a near-miss handle highly", () => {
    expect(handleSimilarityPercent("jsmith88", "jsmith_88")).toBeGreaterThanOrEqual(80);
  });

  it("scores unrelated handles low", () => {
    expect(handleSimilarityPercent("alice-dev", "bob-ops")).toBeLessThan(50);
  });
});

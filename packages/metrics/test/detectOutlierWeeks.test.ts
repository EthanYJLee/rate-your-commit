import { describe, expect, it } from "vitest";
import { detectOutlierWeeks } from "../src/detectOutlierWeeks";
import type { AuthorWeeklyStats } from "../src/types";

function week(weekStart: string, additions: number, deletions: number, commits = 3) {
  return { weekStart: new Date(weekStart), additions, deletions, commits };
}

describe("detectOutlierWeeks", () => {
  it("flags no weeks when volume is consistent", () => {
    const stats: AuthorWeeklyStats[] = [
      {
        authorHandle: "alice",
        weeks: [
          week("2026-01-05", 100, 20),
          week("2026-01-12", 120, 15),
          week("2026-01-19", 90, 25),
        ],
      },
    ];

    expect(detectOutlierWeeks(stats)).toEqual([]);
  });

  it("flags a week that exceeds 5x the author's own median week", () => {
    const stats: AuthorWeeklyStats[] = [
      {
        authorHandle: "bob",
        weeks: [
          week("2026-01-05", 100, 20), // total 120
          week("2026-01-12", 110, 10), // total 120 (median = 120)
          week("2026-01-19", 8000, 200), // total 8200 — vendored drop
        ],
      },
    ];

    const outliers = detectOutlierWeeks(stats);

    expect(outliers).toHaveLength(1);
    expect(outliers[0].authorHandle).toBe("bob");
    expect(outliers[0].totalLines).toBe(8200);
    expect(outliers[0].medianLines).toBe(120);
    expect(outliers[0].weekEnd.getTime() - outliers[0].weekStart.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("respects a custom multiplier", () => {
    const stats: AuthorWeeklyStats[] = [
      {
        authorHandle: "carol",
        weeks: [week("2026-01-05", 100, 0), week("2026-01-12", 100, 0), week("2026-01-19", 250, 0)],
      },
    ];

    // 250 is 2.5x the 100 median — not an outlier at the 5x default...
    expect(detectOutlierWeeks(stats)).toEqual([]);
    // ...but is at a 2x multiplier.
    expect(detectOutlierWeeks(stats, 2)).toHaveLength(1);
  });

  it("skips authors with fewer than two active weeks (no meaningful baseline)", () => {
    const stats: AuthorWeeklyStats[] = [
      { authorHandle: "solo", weeks: [week("2026-01-05", 5000, 5000)] },
    ];

    expect(detectOutlierWeeks(stats)).toEqual([]);
  });

  it("ignores zero-commit weeks when computing the baseline", () => {
    const stats: AuthorWeeklyStats[] = [
      {
        authorHandle: "dave",
        weeks: [
          week("2026-01-05", 100, 0),
          week("2026-01-12", 0, 0, 0), // no activity — excluded from median
          week("2026-01-19", 110, 0),
        ],
      },
    ];

    expect(detectOutlierWeeks(stats)).toEqual([]);
  });
});

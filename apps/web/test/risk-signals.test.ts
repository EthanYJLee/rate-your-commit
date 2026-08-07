import { describe, expect, it } from "vitest";
import {
  computeNightWeekendRatio,
  isBurnoutRisk,
  isSignificantScoreDrop,
} from "../lib/risk-signals";

describe("isSignificantScoreDrop", () => {
  it("flags a drop of exactly the threshold", () => {
    expect(isSignificantScoreDrop(70, 85)).toBe(true); // 15-point drop
  });

  it("flags a drop larger than the threshold", () => {
    expect(isSignificantScoreDrop(50, 90)).toBe(true);
  });

  it("does not flag a drop smaller than the threshold", () => {
    expect(isSignificantScoreDrop(80, 90)).toBe(false); // 10-point drop
  });

  it("does not flag an increase", () => {
    expect(isSignificantScoreDrop(95, 80)).toBe(false);
  });
});

describe("computeNightWeekendRatio", () => {
  it("returns 0 for an empty commit list", () => {
    expect(computeNightWeekendRatio([])).toBe(0);
  });

  it("counts a commit at 23:00 UTC as night", () => {
    const commits = [{ authoredAt: new Date("2026-03-10T23:00:00Z") }]; // Tuesday
    expect(computeNightWeekendRatio(commits)).toBe(100);
  });

  it("counts a commit at 03:00 UTC as night", () => {
    const commits = [{ authoredAt: new Date("2026-03-10T03:00:00Z") }];
    expect(computeNightWeekendRatio(commits)).toBe(100);
  });

  it("counts a Saturday daytime commit as weekend", () => {
    const commits = [{ authoredAt: new Date("2026-03-14T14:00:00Z") }]; // Saturday
    expect(computeNightWeekendRatio(commits)).toBe(100);
  });

  it("does not flag a weekday daytime commit", () => {
    const commits = [{ authoredAt: new Date("2026-03-10T14:00:00Z") }]; // Tuesday
    expect(computeNightWeekendRatio(commits)).toBe(0);
  });

  it("computes the correct percentage across a mix", () => {
    const commits = [
      { authoredAt: new Date("2026-03-10T14:00:00Z") }, // weekday day
      { authoredAt: new Date("2026-03-10T23:00:00Z") }, // night
      { authoredAt: new Date("2026-03-11T14:00:00Z") }, // weekday day
      { authoredAt: new Date("2026-03-14T14:00:00Z") }, // weekend
    ];
    expect(computeNightWeekendRatio(commits)).toBe(50);
  });
});

describe("isBurnoutRisk", () => {
  it("flags a ratio at the threshold", () => {
    expect(isBurnoutRisk(50)).toBe(true);
  });

  it("does not flag a ratio below the threshold", () => {
    expect(isBurnoutRisk(49.9)).toBe(false);
  });
});

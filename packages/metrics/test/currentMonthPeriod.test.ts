import { describe, expect, it } from "vitest";
import { currentMonthPeriod } from "../src/currentMonthPeriod";

describe("currentMonthPeriod", () => {
  it("returns the first-of-month to first-of-next-month range for a given date", () => {
    const period = currentMonthPeriod(new Date("2026-03-17T12:34:56Z"));

    expect(period.start).toEqual(new Date("2026-03-01T00:00:00Z"));
    expect(period.end).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("rolls over correctly across a year boundary", () => {
    const period = currentMonthPeriod(new Date("2026-12-25T00:00:00Z"));

    expect(period.start).toEqual(new Date("2026-12-01T00:00:00Z"));
    expect(period.end).toEqual(new Date("2027-01-01T00:00:00Z"));
  });

  it("defaults to the real current time when no date is passed", () => {
    const before = new Date();
    const period = currentMonthPeriod();
    expect(period.start.getUTCMonth()).toBe(before.getUTCMonth());
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
  });
});

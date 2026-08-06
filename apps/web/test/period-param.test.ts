import { describe, expect, it } from "vitest";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import { parsePeriodParam, periodLabel, periodParam } from "../lib/period-param";

describe("parsePeriodParam", () => {
  it("parses a valid YYYY-MM into that month's PeriodRange", () => {
    const period = parsePeriodParam("2026-03");
    expect(period.start).toEqual(new Date(Date.UTC(2026, 2, 1)));
    expect(period.end).toEqual(new Date(Date.UTC(2026, 3, 1)));
  });

  it("falls back to the current month when the param is undefined", () => {
    expect(parsePeriodParam(undefined)).toEqual(currentMonthPeriod());
  });

  it("falls back to the current month when the param is malformed", () => {
    expect(parsePeriodParam("not-a-period")).toEqual(currentMonthPeriod());
    expect(parsePeriodParam("2026-13")).toEqual(currentMonthPeriod());
    expect(parsePeriodParam("2026-00")).toEqual(currentMonthPeriod());
  });
});

describe("periodParam / periodLabel", () => {
  it("round-trips through parsePeriodParam", () => {
    const period = parsePeriodParam("2026-11");
    expect(periodParam(period)).toBe("2026-11");
  });

  it("pads single-digit months", () => {
    const period = parsePeriodParam("2026-01");
    expect(periodParam(period)).toBe("2026-01");
  });

  it("formats a human-readable Korean label", () => {
    const period = parsePeriodParam("2026-08");
    expect(periodLabel(period)).toBe("2026년 8월");
  });
});

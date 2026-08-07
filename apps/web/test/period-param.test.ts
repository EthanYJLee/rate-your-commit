import { describe, expect, it } from "vitest";
import { currentMonthPeriod } from "@rateyourcommit/metrics";
import {
  groupPeriodsByYear,
  parsePeriodParam,
  periodLabel,
  periodMonthLabel,
  periodParam,
  previousPeriod,
} from "../lib/period-param";

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

  it("periodMonthLabel formats just the month, no year", () => {
    const period = parsePeriodParam("2026-08");
    expect(periodMonthLabel(period)).toBe("8월");
  });
});

describe("groupPeriodsByYear", () => {
  it("groups periods under their year, preserving relative order within a year", () => {
    const periods = [
      parsePeriodParam("2026-08"),
      parsePeriodParam("2026-07"),
      parsePeriodParam("2025-12"),
    ];

    const groups = groupPeriodsByYear(periods);

    expect([...groups.keys()]).toEqual([2026, 2025]);
    expect(groups.get(2026)?.map(periodParam)).toEqual(["2026-08", "2026-07"]);
    expect(groups.get(2025)?.map(periodParam)).toEqual(["2025-12"]);
  });

  it("returns an empty map for an empty input", () => {
    expect(groupPeriodsByYear([]).size).toBe(0);
  });

  it("puts a single period into its own single-entry group", () => {
    const groups = groupPeriodsByYear([parsePeriodParam("2023-03")]);
    expect([...groups.keys()]).toEqual([2023]);
    expect(groups.get(2023)).toHaveLength(1);
  });
});

describe("previousPeriod", () => {
  it("returns the calendar month immediately before", () => {
    const period = parsePeriodParam("2026-08");
    expect(previousPeriod(period)).toEqual(parsePeriodParam("2026-07"));
  });

  it("rolls back across a year boundary", () => {
    const period = parsePeriodParam("2026-01");
    expect(previousPeriod(period)).toEqual(parsePeriodParam("2025-12"));
  });
});

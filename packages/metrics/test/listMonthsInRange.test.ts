import { describe, expect, it } from "vitest";
import { listMonthsInRange } from "../src/listMonthsInRange";

describe("listMonthsInRange", () => {
  it("returns a single-element array when earliest and latest fall in the same month", () => {
    const periods = listMonthsInRange(
      new Date("2026-03-05T00:00:00Z"),
      new Date("2026-03-28T00:00:00Z")
    );

    expect(periods).toEqual([
      { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") },
    ]);
  });

  it("returns one entry per month, oldest first, spanning multiple months", () => {
    const periods = listMonthsInRange(
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-03-01T00:00:00Z")
    );

    expect(periods).toEqual([
      { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") },
      { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") },
      { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") },
    ]);
  });

  it("rolls over a year boundary correctly", () => {
    const periods = listMonthsInRange(
      new Date("2025-11-20T00:00:00Z"),
      new Date("2026-01-05T00:00:00Z")
    );

    expect(periods).toEqual([
      { start: new Date("2025-11-01T00:00:00Z"), end: new Date("2025-12-01T00:00:00Z") },
      { start: new Date("2025-12-01T00:00:00Z"), end: new Date("2026-01-01T00:00:00Z") },
      { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") },
    ]);
  });

  it("returns an empty array when earliest is after latest", () => {
    const periods = listMonthsInRange(
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z")
    );

    expect(periods).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  gaugeArc,
  histogramBuckets,
  pointsToSvgString,
  radarPolygonPoints,
  trendLinePoints,
} from "../lib/chart-math";

describe("gaugeArc", () => {
  it("computes the full circumference for a radius-42 circle", () => {
    const { circumference } = gaugeArc(82.5);
    expect(circumference).toBeCloseTo(263.9, 1);
  });

  it("fills the arc proportionally to the percent", () => {
    const { filledLength, circumference } = gaugeArc(82.5);
    expect(filledLength).toBeCloseTo(circumference * 0.825, 1);
  });

  it("clamps out-of-range percents into 0-100", () => {
    expect(gaugeArc(150).filledLength).toBe(gaugeArc(100).filledLength);
    expect(gaugeArc(-10).filledLength).toBe(0);
  });
});

describe("radarPolygonPoints", () => {
  it("matches the 화면설계서 reference layout for [delivery, quality, collaboration, evaluation] = [88, 74, 80, 91]", () => {
    const points = radarPolygonPoints([88, 74, 80, 91]);
    expect(points[0]).toEqual({ x: 100, y: 29.6 }); // top
    expect(points[1]).toEqual({ x: 159.2, y: 100 }); // right
    expect(points[2]).toEqual({ x: 100, y: 164 }); // bottom
    expect(points[3]).toEqual({ x: 27.2, y: 100 }); // left
  });

  it("places a value of 0 exactly at center", () => {
    const points = radarPolygonPoints([0, 0, 0, 0]);
    for (const p of points) expect(p).toEqual({ x: 100, y: 100 });
  });

  it("places a value of 100 exactly maxRadius away from center", () => {
    const [top] = radarPolygonPoints([100, 0, 0, 0], { center: 100, maxRadius: 80 });
    expect(top).toEqual({ x: 100, y: 20 });
  });
});

describe("pointsToSvgString", () => {
  it("renders points as space-separated x,y pairs", () => {
    expect(pointsToSvgString([{ x: 1, y: 2 }, { x: 3.5, y: 4 }])).toBe("1,2 3.5,4");
  });
});

describe("trendLinePoints", () => {
  it("spaces entries evenly across the usable width", () => {
    const points = trendLinePoints([
      { label: "25.Q3", score: 70 },
      { label: "25.Q4", score: 75 },
      { label: "26.Q1", score: 80 },
    ]);
    expect(points.map((p) => p.x)).toEqual([30, 150, 270]);
  });

  it("scales score 0-100 onto the fixed y range regardless of the visible data spread", () => {
    const [zero] = trendLinePoints([{ label: "m1", score: 0 }]);
    const [hundred] = trendLinePoints([{ label: "m1", score: 100 }]);
    expect(zero.y).toBe(110);
    expect(hundred.y).toBe(20);
  });

  it("returns an empty array for no entries", () => {
    expect(trendLinePoints([])).toEqual([]);
  });

  it("places a single entry at the left edge without dividing by zero", () => {
    const [only] = trendLinePoints([{ label: "m1", score: 50 }]);
    expect(only.x).toBe(30);
  });
});

describe("histogramBuckets", () => {
  it("buckets scores into 60미만/60대/70대/80대/90+", () => {
    const buckets = histogramBuckets([55, 61, 69, 70, 79, 88, 90, 100]);
    expect(buckets).toEqual([
      { label: "60 미만", count: 1 },
      { label: "60대", count: 2 },
      { label: "70대", count: 2 },
      { label: "80대", count: 1 },
      { label: "90+", count: 2 },
    ]);
  });

  it("returns all-zero buckets for an empty score list", () => {
    const buckets = histogramBuckets([]);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("treats bucket boundaries as half-open (min inclusive, max exclusive)", () => {
    const buckets = histogramBuckets([60, 70, 80, 90]);
    expect(buckets.map((b) => b.count)).toEqual([0, 1, 1, 1, 1]);
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PeriodPicker } from "../components/PeriodPicker";
import { parsePeriodParam } from "../lib/period-param";

function period(value: string) {
  return parsePeriodParam(value);
}

describe("PeriodPicker (initial render)", () => {
  it("renders a year option per distinct year present in availablePeriods", () => {
    const availablePeriods = [period("2026-08"), period("2026-07"), period("2025-12")];

    const html = renderToStaticMarkup(
      <PeriodPicker action="/scorecard" selected={period("2026-08")} availablePeriods={availablePeriods} />,
    );

    expect(html).toContain(">2026년<");
    expect(html).toContain(">2025년<");
  });

  it("scopes the month select to only the months present for the selected year", () => {
    const availablePeriods = [period("2026-08"), period("2026-07"), period("2025-12")];

    const html = renderToStaticMarkup(
      <PeriodPicker action="/scorecard" selected={period("2026-08")} availablePeriods={availablePeriods} />,
    );

    expect(html).toContain(">8월<");
    expect(html).toContain(">7월<");
    expect(html).not.toContain(">12월<"); // belongs to 2025, not the selected 2026
  });

  it("submits the combined period through a single hidden input", () => {
    const availablePeriods = [period("2026-08"), period("2025-12")];

    const html = renderToStaticMarkup(
      <PeriodPicker action="/scorecard" selected={period("2026-08")} availablePeriods={availablePeriods} />,
    );

    expect(html).toContain('name="period"');
    expect(html).toContain('value="2026-08"');
  });

  it("falls back to the newest available year when the selected period's year has no data at all", () => {
    // e.g. a hand-typed ?period= pointing at a month nothing's ever
    // been computed for.
    const availablePeriods = [period("2026-08"), period("2026-07")];

    const html = renderToStaticMarkup(
      <PeriodPicker action="/scorecard" selected={period("2020-01")} availablePeriods={availablePeriods} />,
    );

    expect(html).toContain('value="2026-08"');
  });

  it("submits via a plain GET form to the given action, no client fetch", () => {
    const availablePeriods = [period("2026-08")];

    const html = renderToStaticMarkup(
      <PeriodPicker action="/scorecard" selected={period("2026-08")} availablePeriods={availablePeriods} />,
    );

    expect(html).toContain('method="GET"');
    expect(html).toContain('action="/scorecard"');
  });
});

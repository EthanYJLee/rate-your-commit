"use client";

import { useState } from "react";
import type { PeriodRange } from "@rateyourcommit/metrics";
import { groupPeriodsByYear, periodMonthLabel, periodParam } from "../lib/period-param";

/**
 * The app's second client component (after NavLinks — see its own doc
 * comment for why this codebase otherwise stays server-components +
 * plain form actions). Needed because filtering the month dropdown
 * down to only months with real data for the currently-picked year
 * has to react to a year change BEFORE submit — a plain
 * server-rendered <select> can't do that without a page reload.
 *
 * Still submits a single `period=YYYY-MM` GET param via a hidden
 * input kept in sync with the two visible selects, so every page/test
 * reading ?period= (dashboard, scorecard list, scorecard detail) is
 * completely unaffected — only this component's own internals
 * changed. Chosen over a flat/optgrouped single <select> because,
 * with history now backfilled to a project's first commit, a single
 * dropdown's OPEN, scrollable option list doesn't actually shrink from
 * grouping alone (optgroup only adds a heading, browsers don't
 * collapse groups) — splitting into year (few options) + month
 * (≤12, and only the ones that exist for that year) is what actually
 * bounds it.
 */
export function PeriodPicker({
  action,
  selected,
  availablePeriods,
}: {
  action: string;
  selected: PeriodRange;
  availablePeriods: PeriodRange[];
}) {
  const groupedByYear = groupPeriodsByYear(availablePeriods);
  const years = [...groupedByYear.keys()]; // newest first — see groupPeriodsByYear's doc comment

  const selectedYear = selected.start.getUTCFullYear();
  // A syntactically valid but data-less ?period= (e.g. hand-typed,
  // pointing at a month nothing's ever been computed for) can select
  // a year not in groupedByYear at all — fall back to the newest
  // available year rather than rendering a month select with zero
  // options.
  const [year, setYear] = useState(groupedByYear.has(selectedYear) ? selectedYear : years[0]);
  const [period, setPeriod] = useState(selected);

  const monthsForYear = groupedByYear.get(year) ?? [];

  function handleYearChange(nextYear: number) {
    setYear(nextYear);
    const monthsForNextYear = groupedByYear.get(nextYear) ?? [];
    // The previously-picked month may not exist under the new year —
    // fall back to that year's newest available month (first, since
    // each year's list is itself newest-first).
    if (monthsForNextYear.length > 0) setPeriod(monthsForNextYear[0]);
  }

  function handleMonthChange(nextPeriodParam: string) {
    const match = monthsForYear.find((candidate) => periodParam(candidate) === nextPeriodParam);
    if (match) setPeriod(match);
  }

  return (
    <form method="GET" action={action} className="field-row" style={{ marginBottom: "1.25rem" }}>
      <select
        className="select"
        value={year}
        onChange={(event) => handleYearChange(Number(event.target.value))}
        aria-label="연도"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select
        className="select"
        value={periodParam(period)}
        onChange={(event) => handleMonthChange(event.target.value)}
        aria-label="월"
      >
        {monthsForYear.map((candidate) => (
          <option key={periodParam(candidate)} value={periodParam(candidate)}>
            {periodMonthLabel(candidate)}
          </option>
        ))}
      </select>
      <input type="hidden" name="period" value={periodParam(period)} />
      <button type="submit" className="button button--small">
        조회
      </button>
    </form>
  );
}

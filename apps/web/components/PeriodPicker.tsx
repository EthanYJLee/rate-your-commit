import type { PeriodRange } from "@rateyourcommit/metrics";
import { groupPeriodsByYear, periodMonthLabel, periodParam } from "../lib/period-param";

/** Plain GET form, no client JS — matches this app's server-component
 * architecture (see NavLinks.tsx's doc comment: the only client
 * component exists purely for nav-link highlighting). Reused by the
 * dashboard, scorecard-list, and scorecard-detail pages.
 *
 * Options are grouped by year via native <optgroup> — with history now
 * backfilled all the way to a project's first commit, a flat list can
 * run to 40+ options; grouping keeps it scannable with zero JS. */
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

  return (
    <form method="GET" action={action} className="field-row" style={{ marginBottom: "1.25rem" }}>
      <select name="period" defaultValue={periodParam(selected)} className="select">
        {[...groupedByYear.entries()].map(([year, periods]) => (
          <optgroup key={year} label={`${year}년`}>
            {periods.map((period) => (
              <option key={periodParam(period)} value={periodParam(period)}>
                {periodMonthLabel(period)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button type="submit" className="button button--small">
        조회
      </button>
    </form>
  );
}

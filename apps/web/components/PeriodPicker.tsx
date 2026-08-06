import type { PeriodRange } from "@rateyourcommit/metrics";
import { periodLabel, periodParam } from "../lib/period-param";

/** Plain GET form, no client JS — matches this app's server-component
 * architecture (see NavLinks.tsx's doc comment: the only client
 * component exists purely for nav-link highlighting). Reused by the
 * dashboard and scorecard-list pages, the two screens that were
 * hard-locked to "this month" with no way to look at history. */
export function PeriodPicker({
  action,
  selected,
  availablePeriods,
}: {
  action: string;
  selected: PeriodRange;
  availablePeriods: PeriodRange[];
}) {
  return (
    <form method="GET" action={action} className="field-row" style={{ marginBottom: "1.25rem" }}>
      <select name="period" defaultValue={periodParam(selected)} className="select">
        {availablePeriods.map((period) => (
          <option key={periodParam(period)} value={periodParam(period)}>
            {periodLabel(period)}
          </option>
        ))}
      </select>
      <button type="submit" className="button button--small">
        조회
      </button>
    </form>
  );
}

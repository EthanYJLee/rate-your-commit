export { detectOutlierWeeks, DEFAULT_OUTLIER_MULTIPLIER } from "./detectOutlierWeeks";
export {
  computeAxisMetrics,
  computeRawActivity,
  NO_ACTIVITY_DEFAULT,
  UNIMPLEMENTED_AXIS_PLACEHOLDER,
} from "./computeAxisMetrics";
export { currentMonthPeriod } from "./currentMonthPeriod";
export { listMonthsInRange } from "./listMonthsInRange";
export type {
  AuthorWeeklyStats,
  WeeklyActivity,
  OutlierWeek,
  AxisMetrics,
  CommitForMetrics,
  TicketForMetrics,
  PeriodRange,
  RawActivity,
} from "./types";

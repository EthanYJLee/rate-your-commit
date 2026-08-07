/**
 * Dashboard-only "risk alert" heuristics (S-01's 리스크 알림 리스트) —
 * presentation/monitoring signals, never fed into ScoreResult or
 * finalScore. Kept in apps/web (not packages/metrics) for the same
 * reason lib/chart-math.ts is: this is display logic, not scoring
 * logic, even though it's still a pure, testable function.
 *
 * Of the original 화면설계서's five example signals (급락/동료평가
 * 미제출/번아웃/MR반려율/품질게이트), only two are computable from data
 * this app actually has — no PR-review data (collaboration axis is a
 * placeholder) and no peer-evaluation module (S-05, deferred) means
 * "미제출"/"MR 반려율"/"품질게이트" have no real data source at all.
 */

/** A person's finalScore dropping by at least this many points
 * month-over-month is flagged. Matches the 화면설계서's own dummy
 * example ("85→70", an 18% drop) in order of magnitude. */
export const SCORE_DROP_THRESHOLD = 15;

export function isSignificantScoreDrop(current: number, previous: number): boolean {
  return previous - current >= SCORE_DROP_THRESHOLD;
}

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;
/** At or above this ratio of night/weekend commits, flagged as a
 * possible burnout/rushed-work signal — not a performance judgment,
 * see the 화면설계서's own framing ("그 자체가 성과 지표는 아니나
 * 번아웃·급조 작업 리스크로서 참고 신호로 반영할 가치가 있다"). */
export const BURNOUT_RATIO_PERCENT_THRESHOLD = 50;

function isNightOrWeekend(date: Date): boolean {
  // Caveat, stated plainly rather than silently assumed: this reads
  // Commit.authoredAt's stored UTC hour/weekday, NOT the committing
  // author's own local time (git commit timestamps carry a timezone
  // offset, but this schema doesn't persist it — see
  // packages/connectors' RawCommit). For an org whose devs span
  // multiple timezones this is an approximation, not a precise
  // per-author "was it actually late at night for them" signal.
  const hour = date.getUTCHours();
  const day = date.getUTCDay(); // 0=Sunday, 6=Saturday
  const isNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  const isWeekend = day === 0 || day === 6;
  return isNight || isWeekend;
}

/** % (0-100, one decimal) of the given commits authored at night or
 * on a weekend. 0 for an empty list — no commits is not itself a
 * burnout signal. */
export function computeNightWeekendRatio(commits: { authoredAt: Date }[]): number {
  if (commits.length === 0) return 0;
  const flagged = commits.filter((commit) => isNightOrWeekend(commit.authoredAt)).length;
  return Math.round((flagged / commits.length) * 1000) / 10;
}

export function isBurnoutRisk(nightWeekendRatioPercent: number): boolean {
  return nightWeekendRatioPercent >= BURNOUT_RATIO_PERCENT_THRESHOLD;
}

import { round1 } from "./chart-math";

export const UNASSIGNED_TEAM_LABEL = "미배정";

export interface TeamScoreRow {
  /** null when the person has no Team assigned yet. */
  teamName: string | null;
  finalScore: number;
}

export interface TeamAverage {
  teamName: string;
  avgScore: number;
  memberCount: number;
}

/**
 * Averages this period's finalScore per team (S-01 팀별 성과 비교).
 * People with no team assigned are bucketed under UNASSIGNED_TEAM_LABEL
 * rather than silently dropped — same "surface the gap" instinct as
 * the unresolved-identity warning banner. That bucket is always last,
 * regardless of its average, since it's not a real team to compare.
 */
export function groupScoresByTeam(rows: TeamScoreRow[]): TeamAverage[] {
  const scoresByTeam = new Map<string, number[]>();
  for (const row of rows) {
    const teamName = row.teamName ?? UNASSIGNED_TEAM_LABEL;
    const scores = scoresByTeam.get(teamName) ?? [];
    scores.push(row.finalScore);
    scoresByTeam.set(teamName, scores);
  }

  return [...scoresByTeam.entries()]
    .map(([teamName, scores]) => ({
      teamName,
      avgScore: round1(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      memberCount: scores.length,
    }))
    .sort((a, b) => {
      if (a.teamName === UNASSIGNED_TEAM_LABEL) return 1;
      if (b.teamName === UNASSIGNED_TEAM_LABEL) return -1;
      return b.avgScore - a.avgScore;
    });
}

import { describe, expect, it } from "vitest";
import { groupScoresByTeam, UNASSIGNED_TEAM_LABEL } from "../lib/team-aggregation";

describe("groupScoresByTeam", () => {
  it("averages finalScore per team", () => {
    const result = groupScoresByTeam([
      { teamName: "정산팀", finalScore: 80 },
      { teamName: "정산팀", finalScore: 84 },
      { teamName: "ERP팀", finalScore: 76 },
    ]);

    expect(result).toEqual([
      { teamName: "정산팀", avgScore: 82, memberCount: 2 },
      { teamName: "ERP팀", avgScore: 76, memberCount: 1 },
    ]);
  });

  it("sorts teams by average score, descending", () => {
    const result = groupScoresByTeam([
      { teamName: "낮은팀", finalScore: 60 },
      { teamName: "높은팀", finalScore: 90 },
    ]);

    expect(result.map((r) => r.teamName)).toEqual(["높은팀", "낮은팀"]);
  });

  it("buckets people with no team under the 미배정 label", () => {
    const result = groupScoresByTeam([
      { teamName: null, finalScore: 70 },
      { teamName: null, finalScore: 90 },
    ]);

    expect(result).toEqual([{ teamName: UNASSIGNED_TEAM_LABEL, avgScore: 80, memberCount: 2 }]);
  });

  it("always places the 미배정 bucket last, even if its average is highest", () => {
    const result = groupScoresByTeam([
      { teamName: null, finalScore: 99 },
      { teamName: "일반팀", finalScore: 50 },
    ]);

    expect(result.map((r) => r.teamName)).toEqual(["일반팀", UNASSIGNED_TEAM_LABEL]);
  });

  it("returns an empty array for no rows", () => {
    expect(groupScoresByTeam([])).toEqual([]);
  });
});

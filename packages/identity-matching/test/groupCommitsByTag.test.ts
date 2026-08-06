import { describe, expect, it } from "vitest";
import { groupCommitsByTag } from "../src/groupCommitsByTag";

describe("groupCommitsByTag", () => {
  it("groups commits by their extracted tag", () => {
    const groups = groupCommitsByTag([
      { id: "c1", message: "[개발자T] fix" },
      { id: "c2", message: "[개발자T] another fix" },
      { id: "c3", message: "[개발자K] feature" },
      { id: "c4", message: "no tag here" },
    ]);

    expect(groups).toEqual([
      { tag: "개발자T", commitIds: ["c1", "c2"] },
      { tag: "개발자K", commitIds: ["c3"] },
      { tag: "", commitIds: ["c4"] },
    ]);
  });

  it("sorts larger tagged groups before smaller ones", () => {
    const groups = groupCommitsByTag([
      { id: "c1", message: "[solo] x" },
      { id: "c2", message: "[busy] a" },
      { id: "c3", message: "[busy] b" },
      { id: "c4", message: "[busy] c" },
    ]);

    expect(groups.map((g) => g.tag)).toEqual(["busy", "solo"]);
  });

  it("always puts the untagged bucket last even if it's the largest", () => {
    const groups = groupCommitsByTag([
      { id: "c1", message: "no tag" },
      { id: "c2", message: "no tag either" },
      { id: "c3", message: "no tag either" },
      { id: "c4", message: "[개발자T] fix" },
    ]);

    expect(groups[groups.length - 1].tag).toBe("");
  });

  it("returns an empty array for no commits", () => {
    expect(groupCommitsByTag([])).toEqual([]);
  });
});

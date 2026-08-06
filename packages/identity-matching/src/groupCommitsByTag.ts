import { extractSharedAccountTag } from "./extractSharedAccountTag";

export interface TaggableCommit {
  id: string;
  message: string;
}

export interface TagGroup {
  /** Empty string means "no [태그] found in this commit's message". */
  tag: string;
  commitIds: string[];
}

/**
 * Groups a shared account's commits by their hand-tagged real
 * contributor (see extractSharedAccountTag). Used both to display the
 * "여기 숨어있는 기여자" breakdown on /identities and to know which
 * commit ids move when someone splits a tag off into its own identity.
 * Sorted tagged-first, largest group first — the untagged bucket (if
 * any) always comes last since it's not actionable.
 */
export function groupCommitsByTag(commits: TaggableCommit[]): TagGroup[] {
  const commitIdsByTag = new Map<string, string[]>();

  for (const commit of commits) {
    const tag = extractSharedAccountTag(commit.message) ?? "";
    const commitIds = commitIdsByTag.get(tag) ?? [];
    commitIds.push(commit.id);
    commitIdsByTag.set(tag, commitIds);
  }

  return [...commitIdsByTag.entries()]
    .map(([tag, commitIds]) => ({ tag, commitIds }))
    .sort((a, b) => {
      if (a.tag === "" && b.tag !== "") return 1;
      if (a.tag !== "" && b.tag === "") return -1;
      return b.commitIds.length - a.commitIds.length;
    });
}

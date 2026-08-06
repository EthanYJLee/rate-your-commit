export { suggestPersonForIdentity, SIMILARITY_THRESHOLD } from "./suggestPersonForIdentity";
export { handleSimilarityPercent, levenshteinDistance } from "./levenshtein";
export { extractSharedAccountTag } from "./extractSharedAccountTag";
export { groupCommitsByTag } from "./groupCommitsByTag";
export type { IdentityRef, PersonCandidate, MatchSuggestion } from "./types";
export type { TaggableCommit, TagGroup } from "./groupCommitsByTag";

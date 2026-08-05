import { handleSimilarityPercent } from "./levenshtein";
import type { IdentityRef, MatchSuggestion, PersonCandidate } from "./types";

/**
 * Below this handle-similarity %, we don't suggest at all — a weak
 * match is worse than no suggestion (it erodes trust in the ones
 * that ARE good). Advisory only either way: a human always confirms
 * or overrides on /identities, this just pre-selects the dropdown.
 */
export const SIMILARITY_THRESHOLD = 70;

/**
 * S-07 rule-based match suggestion (docs/ARCHITECTURE.md §3): exact
 * email match first (100% confidence, unambiguous), then the best
 * handle-similarity match against identities already linked to a
 * Person. Pure function, no I/O — same "explainable, redo by hand"
 * bar as packages/scoring. Returns null when nothing clears the bar.
 */
export function suggestPersonForIdentity(
  identity: IdentityRef,
  candidates: PersonCandidate[]
): MatchSuggestion | null {
  const email = identity.email?.toLowerCase();
  if (email) {
    for (const candidate of candidates) {
      const hasEmailMatch = candidate.identities.some(
        (other) => other.email?.toLowerCase() === email
      );
      if (hasEmailMatch) {
        return {
          personId: candidate.personId,
          personDisplayName: candidate.personDisplayName,
          reason: "이메일 완전일치",
          confidence: 100,
        };
      }
    }
  }

  let best: MatchSuggestion | null = null;
  for (const candidate of candidates) {
    for (const other of candidate.identities) {
      const similarity = handleSimilarityPercent(identity.handle, other.handle);
      if (similarity < SIMILARITY_THRESHOLD) continue;
      if (best && similarity <= best.confidence) continue;

      best = {
        personId: candidate.personId,
        personDisplayName: candidate.personDisplayName,
        reason: `핸들 유사도 ${similarity}% (vs "${other.handle}")`,
        confidence: similarity,
      };
    }
  }

  return best;
}

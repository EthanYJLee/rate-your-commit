export interface IdentityRef {
  handle: string;
  email?: string | null;
}

/** One already-Person-linked cluster of identities this candidate could be suggested from. */
export interface PersonCandidate {
  personId: string;
  personDisplayName: string;
  identities: IdentityRef[];
}

export interface MatchSuggestion {
  personId: string;
  personDisplayName: string;
  /** Human-readable, e.g. "이메일 완전일치" or '핸들 유사도 82% (vs "jsmith88")'. */
  reason: string;
  /** 0-100. Exact email match is always 100; handle similarity is the % itself. */
  confidence: number;
}

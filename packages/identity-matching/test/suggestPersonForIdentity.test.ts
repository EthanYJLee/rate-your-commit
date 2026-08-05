import { describe, expect, it } from "vitest";
import { suggestPersonForIdentity } from "../src/suggestPersonForIdentity";
import type { PersonCandidate } from "../src/types";

const CANDIDATES: PersonCandidate[] = [
  {
    personId: "person-alice",
    personDisplayName: "Alice Real",
    identities: [{ handle: "alice-dev", email: "alice@acme.com" }],
  },
  {
    personId: "person-bob",
    personDisplayName: "Bob Real",
    identities: [{ handle: "jsmith88", email: "bob@acme.com" }],
  },
];

describe("suggestPersonForIdentity", () => {
  it("prefers an exact email match over handle similarity", () => {
    const suggestion = suggestPersonForIdentity(
      { handle: "totally-different-handle", email: "alice@acme.com" },
      CANDIDATES
    );

    expect(suggestion).toEqual({
      personId: "person-alice",
      personDisplayName: "Alice Real",
      reason: "이메일 완전일치",
      confidence: 100,
    });
  });

  it("matches email case-insensitively", () => {
    const suggestion = suggestPersonForIdentity(
      { handle: "x", email: "ALICE@ACME.COM" },
      CANDIDATES
    );
    expect(suggestion?.personId).toBe("person-alice");
  });

  it("falls back to handle similarity when there's no email match", () => {
    const suggestion = suggestPersonForIdentity(
      { handle: "jsmith_88", email: "someone-else@example.com" },
      CANDIDATES
    );

    expect(suggestion?.personId).toBe("person-bob");
    expect(suggestion?.reason).toContain("핸들 유사도");
    expect(suggestion?.confidence).toBeGreaterThanOrEqual(70);
  });

  it("returns null when nothing clears the similarity threshold", () => {
    const suggestion = suggestPersonForIdentity(
      { handle: "zzz-totally-unrelated-qqq", email: undefined },
      CANDIDATES
    );

    expect(suggestion).toBeNull();
  });

  it("returns the single best match when multiple candidates are above threshold", () => {
    const candidates: PersonCandidate[] = [
      { personId: "p1", personDisplayName: "Close-ish", identities: [{ handle: "jsmith8" }] },
      { personId: "p2", personDisplayName: "Exact-ish", identities: [{ handle: "jsmith88" }] },
    ];

    const suggestion = suggestPersonForIdentity({ handle: "jsmith88" }, candidates);

    expect(suggestion?.personId).toBe("p2");
    expect(suggestion?.confidence).toBe(100);
  });

  it("returns null with no candidates at all", () => {
    expect(suggestPersonForIdentity({ handle: "alice-dev" }, [])).toBeNull();
  });
});

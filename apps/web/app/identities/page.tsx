import { prisma } from "@rateyourcommit/db";
import { suggestPersonForIdentity } from "@rateyourcommit/identity-matching";
import type { MatchSuggestion, PersonCandidate } from "@rateyourcommit/identity-matching";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "확인됨",
  pending: "미해결",
  shared_account: "공유계정",
  unresolved: "귀속불가",
};

/** Groups already-Person-linked identities by person, for S-07 match suggestions. */
function buildCandidates(
  people: { id: string; displayName: string }[],
  linkedIdentities: { handle: string; email: string | null; personId: string | null }[]
): PersonCandidate[] {
  const byPersonId = new Map<string, PersonCandidate>(
    people.map((person) => [person.id, { personId: person.id, personDisplayName: person.displayName, identities: [] }])
  );
  for (const identity of linkedIdentities) {
    if (!identity.personId) continue;
    byPersonId.get(identity.personId)?.identities.push({ handle: identity.handle, email: identity.email });
  }
  return [...byPersonId.values()];
}

export default async function IdentitiesPage() {
  const [identities, people] = await Promise.all([
    prisma.identity.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { commits: true } }, person: true },
    }),
    prisma.person.findMany({ orderBy: { displayName: "asc" } }),
  ]);

  const candidates = buildCandidates(
    people,
    identities.filter((identity) => identity.personId !== null)
  );

  const suggestionByIdentityId = new Map<string, MatchSuggestion>();
  for (const identity of identities) {
    if (identity.person) continue;
    const suggestion = suggestPersonForIdentity(identity, candidates);
    if (suggestion) suggestionByIdentityId.set(identity.id, suggestion);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: ".75rem",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 700,
        }}
      >
        S-07 · 작성자 아이덴티티 매핑
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: ".5rem" }}>
        미해결 아이덴티티 큐
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem" }}>
        총 {identities.length}개 아이덴티티 · DB에서 실시간 조회 · 규칙 기반 추천(이메일
        완전일치/핸들 유사도)은 드롭다운 기본값일 뿐 최종 결정은 직접 확인하세요.
      </p>

      {identities.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>
          아직 동기화된 데이터가 없습니다. <code>apps/worker</code>를 GITHUB_TOKEN과
          함께 실행하거나 <code>npm run seed -w packages/db</code>로 예시 데이터를
          넣어보세요.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: ".6rem" }}>handle</th>
              <th style={{ padding: ".6rem" }}>email</th>
              <th style={{ padding: ".6rem" }}>상태</th>
              <th style={{ padding: ".6rem", textAlign: "right" }}>커밋 수</th>
              <th style={{ padding: ".6rem" }}>병합</th>
            </tr>
          </thead>
          <tbody>
            {identities.map((identity) => {
              const suggestion = suggestionByIdentityId.get(identity.id);
              return (
                <tr key={identity.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: ".6rem", fontFamily: "ui-monospace, monospace" }}>
                    {identity.handle}
                  </td>
                  <td style={{ padding: ".6rem", color: "var(--ink-soft)" }}>
                    {identity.email ?? "—"}
                  </td>
                  <td style={{ padding: ".6rem" }}>
                    {STATUS_LABEL[identity.status] ?? identity.status}
                  </td>
                  <td style={{ padding: ".6rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {identity._count.commits}
                  </td>
                  <td style={{ padding: ".6rem" }}>
                    {identity.person ? (
                      <span>{identity.person.displayName}</span>
                    ) : (
                      <>
                        <form
                          action={`/api/identities/${identity.id}/merge`}
                          method="POST"
                          style={{ display: "flex", gap: ".4rem", alignItems: "center" }}
                        >
                          <select
                            name="personId"
                            defaultValue={suggestion?.personId ?? ""}
                            style={{ fontSize: ".85rem" }}
                          >
                            <option value="">— 새 인물로 등록 —</option>
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.displayName}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            name="newPersonName"
                            placeholder="새 인물 이름"
                            defaultValue={identity.handle}
                            style={{ fontSize: ".85rem", width: "9rem" }}
                          />
                          <button type="submit" style={{ fontSize: ".85rem" }}>
                            병합
                          </button>
                        </form>
                        {suggestion && (
                          <p style={{ fontSize: ".75rem", color: "var(--accent)", margin: ".3rem 0 0" }}>
                            추천: {suggestion.personDisplayName} ({suggestion.reason})
                          </p>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

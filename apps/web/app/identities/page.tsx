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
    <main className="page">
      <p className="eyebrow">S-07 · 작성자 아이덴티티 매핑</p>
      <h1 className="page-title">미해결 아이덴티티 큐</h1>
      <p className="page-subtitle">
        총 {identities.length}개 아이덴티티 · DB에서 실시간 조회 · 규칙 기반 추천(이메일
        완전일치/핸들 유사도)은 드롭다운 기본값일 뿐 최종 결정은 직접 확인하세요.
      </p>

      {identities.length === 0 ? (
        <p className="empty-state">
          아직 동기화된 데이터가 없습니다. <code>apps/worker</code>를 GITHUB_TOKEN과
          함께 실행하거나 <code>npm run seed -w packages/db</code>로 예시 데이터를
          넣어보세요.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>handle</th>
              <th>email</th>
              <th>상태</th>
              <th className="num">커밋 수</th>
              <th>병합</th>
            </tr>
          </thead>
          <tbody>
            {identities.map((identity) => {
              const suggestion = suggestionByIdentityId.get(identity.id);
              return (
                <tr key={identity.id}>
                  <td className="mono">{identity.handle}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{identity.email ?? "—"}</td>
                  <td>
                    <span className="badge badge--neutral">
                      {STATUS_LABEL[identity.status] ?? identity.status}
                    </span>
                  </td>
                  <td className="num">{identity._count.commits}</td>
                  <td>
                    {identity.person ? (
                      <span>{identity.person.displayName}</span>
                    ) : (
                      <>
                        <form
                          action={`/api/identities/${identity.id}/merge`}
                          method="POST"
                          className="field-row"
                        >
                          <select name="personId" defaultValue={suggestion?.personId ?? ""} className="select">
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
                            className="input"
                            style={{ width: "9rem" }}
                          />
                          <button type="submit" className="button button--small">
                            병합
                          </button>
                        </form>
                        {suggestion && (
                          <p className="suggestion">
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

import { Fragment } from "react";
import { prisma } from "@rateyourcommit/db";
import { groupCommitsByTag, suggestPersonForIdentity } from "@rateyourcommit/identity-matching";
import type { MatchSuggestion, PersonCandidate } from "@rateyourcommit/identity-matching";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "확인됨",
  pending: "미해결",
  shared_account: "공유계정",
  unresolved: "귀속불가",
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  merge: "병합",
  unmerge: "병합 해제",
  split: "분리",
};

const AUDIT_LOG_LIMIT = 20;

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

function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export default async function IdentitiesPage() {
  const [identities, people, auditLogs] = await Promise.all([
    prisma.identity.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { commits: true } }, person: true },
    }),
    prisma.person.findMany({ orderBy: { displayName: "asc" } }),
    prisma.identityAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: AUDIT_LOG_LIMIT,
      include: { identity: true, person: true },
    }),
  ]);

  const sharedAccountIds = identities
    .filter((identity) => identity.status === "shared_account")
    .map((identity) => identity.id);
  const sharedCommits =
    sharedAccountIds.length > 0
      ? await prisma.commit.findMany({
          where: { identityId: { in: sharedAccountIds } },
          select: { id: true, message: true, identityId: true },
        })
      : [];

  const commitsByIdentityId = new Map<string, { id: string; message: string }[]>();
  for (const commit of sharedCommits) {
    const list = commitsByIdentityId.get(commit.identityId) ?? [];
    list.push({ id: commit.id, message: commit.message });
    commitsByIdentityId.set(commit.identityId, list);
  }

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
              const tagGroups =
                identity.status === "shared_account"
                  ? groupCommitsByTag(commitsByIdentityId.get(identity.id) ?? [])
                  : [];

              return (
                <Fragment key={identity.id}>
                  <tr>
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
                        <div className="field-row">
                          <span>{identity.person.displayName}</span>
                          <form action={`/api/identities/${identity.id}/unmerge`} method="POST">
                            <button type="submit" className="button button--small">
                              병합 해제
                            </button>
                          </form>
                        </div>
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
                  {tagGroups.length > 0 && (
                    <tr>
                      <td colSpan={5}>
                        <p className="hint" style={{ margin: 0 }}>
                          공유계정 태그 분포 —{" "}
                          {tagGroups.map((group, i) => (
                            <span key={group.tag || "untagged"}>
                              {i > 0 && " · "}
                              {group.tag ? (
                                <>
                                  <span className="mono">[{group.tag}]</span> {group.commitIds.length}건{" "}
                                  <form
                                    action={`/api/identities/${identity.id}/split`}
                                    method="POST"
                                    style={{ display: "inline" }}
                                  >
                                    <input type="hidden" name="tag" value={group.tag} />
                                    <button type="submit" className="button button--small">
                                      분리
                                    </button>
                                  </form>
                                </>
                              ) : (
                                <>태그없음 {group.commitIds.length}건</>
                              )}
                            </span>
                          ))}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {auditLogs.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem", margin: "2rem 0 .8rem" }}>최근 병합/분리/해제 이력</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>작업</th>
                <th>대상 identity</th>
                <th>인물</th>
                <th>처리자</th>
                <th>일시</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{AUDIT_ACTION_LABEL[log.action] ?? log.action}</td>
                  <td className="mono">{log.identity.handle}</td>
                  <td>{log.person?.displayName ?? "—"}</td>
                  <td className="mono">{log.actorLogin}</td>
                  <td className="mono" style={{ color: "var(--ink-soft)" }}>
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{log.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

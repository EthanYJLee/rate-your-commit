import { prisma } from "@rateyourcommit/db";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [teams, people] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { people: true } } },
    }),
    prisma.person.findMany({
      orderBy: { displayName: "asc" },
      include: { team: true },
    }),
  ]);

  return (
    <main className="page">
      <p className="eyebrow">조직 설정 · 팀</p>
      <h1 className="page-title">팀 관리</h1>
      <p className="page-subtitle">
        팀 소속 정보는 어떤 연동 데이터에도 없어서 여기서 직접 배정합니다. S-01
        대시보드의 팀별 성과 비교에 반영됩니다.
      </p>

      {error && <p className="error-banner">{error}</p>}

      <form
        action="/api/settings/teams"
        method="POST"
        className="field-row"
        style={{ marginBottom: "1.75rem" }}
      >
        <input type="text" name="name" placeholder="새 팀 이름" className="input" required />
        <button type="submit" className="button button--primary">
          팀 추가
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="empty-state">아직 등록된 팀이 없습니다.</p>
      ) : (
        <div className="chart-grid" style={{ marginBottom: "1.75rem" }}>
          {teams.map((team) => (
            <div key={team.id} className="card chart-card">
              <h2 className="chart-card__title">{team.name}</h2>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>{team._count.people}명</p>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "1.05rem", margin: "0 0 .8rem" }}>인원별 팀 배정</h2>
      {people.length === 0 ? (
        <p className="empty-state">아직 등록된 인물이 없습니다.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>현재 팀</th>
              <th>배정</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>{person.displayName}</td>
                <td>{person.team?.name ?? "미배정"}</td>
                <td>
                  <form
                    action={`/api/people/${person.id}/team`}
                    method="POST"
                    className="field-row"
                  >
                    <select name="teamId" defaultValue={person.teamId ?? ""} className="select">
                      <option value="">— 미배정 —</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="button button--small">
                      저장
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

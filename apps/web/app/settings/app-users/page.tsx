import { prisma } from "@rateyourcommit/db";
import { MIN_PASSWORD_LENGTH } from "../../../lib/password";

export const dynamic = "force-dynamic";

/**
 * Admin-provisioning UI for email/password sign-in accounts (see
 * auth.ts — additive to GitHub OAuth). No self-registration: an admin
 * types both the email and an initial password here and tells the
 * new user out of band (there's no email-sending infra in this
 * project — see docs' password-reset scope note). Mirrors the
 * /settings/teams page's create-form + list pattern.
 */
export default async function AppUsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Explicit select — passwordHash is never rendered, so it shouldn't
  // even be pulled into the server's memory/render closure (security
  // review recommendation: defense-in-depth against a future refactor
  // accidentally exposing it).
  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, createdAt: true },
  });

  return (
    <main className="page">
      <p className="eyebrow">조직 설정 · 계정</p>
      <h1 className="page-title">이메일/비밀번호 계정</h1>
      <p className="page-subtitle">
        GitHub 계정이 없는 사람에게 발급하는 로그인 수단입니다. 가입 신청 없이 관리자가
        직접 발급하며, 비밀번호 재설정은 지원하지 않으니(잊어버리면 계정을 회수하고
        새로 발급하세요) 발급한 비밀번호는 본인에게 직접 전달해 주세요.
      </p>

      {error && <p className="error-banner">{error}</p>}

      <form
        action="/api/settings/app-users"
        method="POST"
        className="field-row"
        style={{ marginBottom: "1.75rem" }}
      >
        <input type="email" name="email" placeholder="이메일" className="input" required />
        <input
          type="password"
          name="password"
          placeholder={`초기 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`}
          className="input"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <button type="submit" className="button button--primary">
          계정 발급
        </button>
      </form>

      {users.length === 0 ? (
        <p className="empty-state">아직 발급된 계정이 없습니다.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>이메일</th>
              <th>발급일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  <form action={`/api/settings/app-users/${user.id}/revoke`} method="POST">
                    <button type="submit" className="button button--small">
                      회수
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

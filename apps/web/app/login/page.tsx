import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";
import { credentialsSignIn } from "../../lib/credentials-sign-in";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in (e.g. revisited /login directly, or the OAuth
  // flow completed but redirectTo below wasn't set yet on an older
  // build) — don't show the login form again.
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="page page--center">
      <p className="eyebrow" style={{ justifyContent: "center" }}>
        RateYourCommit
      </p>
      <h1 className="page-title" style={{ fontSize: "1.4rem" }}>로그인이 필요합니다</h1>
      <p className="page-subtitle">
        허용된 GitHub 계정 또는 관리자가 발급한 이메일/비밀번호 계정으로 로그인할 수
        있습니다. 접근 권한이 필요하면 관리자에게 문의하세요.
      </p>

      {error && <p className="error-banner">{error}</p>}

      <form
        action={async () => {
          "use server";
          // Without an explicit redirectTo, Auth.js sends the user back
          // to wherever they started the sign-in flow from — which is
          // /login itself, making a successful login look like nothing
          // happened.
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="button button--primary"
          style={{ padding: ".7rem 1.6rem", fontSize: "1rem" }}
        >
          GitHub로 로그인
        </button>
      </form>

      <p style={{ margin: "1.5rem 0 .75rem", color: "var(--ink-soft)" }}>또는</p>

      <form
        action={credentialsSignIn}
        className="field-row"
        style={{ flexDirection: "column", alignItems: "stretch", gap: ".6rem", maxWidth: "20rem" }}
      >
        <input
          type="email"
          name="email"
          placeholder="이메일"
          className="input"
          required
          autoComplete="email"
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          className="input"
          required
          autoComplete="current-password"
        />
        <button type="submit" className="button" style={{ padding: ".7rem 1.6rem", fontSize: "1rem" }}>
          이메일로 로그인
        </button>
      </form>
    </main>
  );
}

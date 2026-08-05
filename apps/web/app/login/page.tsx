import { signIn } from "../../auth";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
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
        RateYourCommit
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>로그인이 필요합니다</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem" }}>
        허용된 GitHub 계정만 로그인할 수 있습니다. 접근 권한이 필요하면 관리자에게
        문의하세요.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github");
        }}
      >
        <button type="submit" style={{ padding: ".7rem 1.5rem", fontSize: "1rem" }}>
          GitHub로 로그인
        </button>
      </form>
    </main>
  );
}

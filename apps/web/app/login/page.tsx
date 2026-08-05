import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";

export default async function LoginPage() {
  // Already signed in (e.g. revisited /login directly, or the OAuth
  // flow completed but redirectTo below wasn't set yet on an older
  // build) — don't show the login form again.
  const session = await auth();
  if (session) redirect("/");

  return (
    <main className="page page--center">
      <p className="eyebrow" style={{ justifyContent: "center" }}>
        RateYourCommit
      </p>
      <h1 className="page-title" style={{ fontSize: "1.4rem" }}>로그인이 필요합니다</h1>
      <p className="page-subtitle">
        허용된 GitHub 계정만 로그인할 수 있습니다. 접근 권한이 필요하면 관리자에게
        문의하세요.
      </p>
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
        <button type="submit" className="button button--primary" style={{ padding: ".7rem 1.6rem", fontSize: "1rem" }}>
          GitHub로 로그인
        </button>
      </form>
    </main>
  );
}

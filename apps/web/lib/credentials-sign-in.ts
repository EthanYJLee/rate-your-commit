"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "../auth";

/**
 * Server action for the login page's email/password form. Kept out
 * of app/login/page.tsx (rather than inlined) so tests can mock this
 * one module instead of pulling in next-auth's real runtime code —
 * unmocked `import ... from "next-auth"` fails to resolve
 * `next/server` under Vitest's module resolution (a pre-existing
 * environment quirk, not a Next.js/production issue; every other
 * test that touches auth.ts avoids it the same way, by mocking
 * "../auth" instead of letting it load for real).
 */
export async function credentialsSignIn(formData: FormData): Promise<void> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    // signIn's own SUCCESS path also throws internally (Next.js's
    // redirect mechanism) — only an AuthError (wrong credentials,
    // rate-limited) should be treated as a login failure here;
    // anything else must propagate unchanged.
    if (err instanceof AuthError) {
      redirect("/login?error=이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    throw err;
  }
}

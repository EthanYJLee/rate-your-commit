import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockAuth = vi.fn();
vi.mock("../auth", () => ({ auth: mockAuth, signIn: vi.fn() }));
// Mocked for the same reason ../auth is: it transitively imports the
// real "next-auth" package (for AuthError), which fails to resolve
// "next/server" under Vitest — see credentials-sign-in.ts's doc
// comment. Not exercised by these tests either way.
vi.mock("../lib/credentials-sign-in", () => ({ credentialsSignIn: vi.fn() }));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

const { default: LoginPage } = await import("../app/login/page");

function props(error?: string) {
  return { searchParams: Promise.resolve(error ? { error } : {}) };
}

describe("/login page", () => {
  it("redirects to / when already signed in", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Alice" } });

    await expect(LoginPage(props())).rejects.toThrow("REDIRECT:/");
  });

  it("renders the sign-in form when not signed in", async () => {
    mockAuth.mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage(props()));

    expect(html).toContain("GitHub로 로그인");
  });

  it("also renders the email/password form", async () => {
    mockAuth.mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage(props()));

    expect(html).toContain("이메일로 로그인");
  });

  it("renders the error message from the query param, when present", async () => {
    mockAuth.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await LoginPage(props("이메일 또는 비밀번호가 올바르지 않습니다."))
    );

    expect(html).toContain("이메일 또는 비밀번호가 올바르지 않습니다.");
  });
});

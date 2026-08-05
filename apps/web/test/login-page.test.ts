import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockAuth = vi.fn();
vi.mock("../auth", () => ({ auth: mockAuth, signIn: vi.fn() }));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

const { default: LoginPage } = await import("../app/login/page");

describe("/login page", () => {
  it("redirects to / when already signed in", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Alice" } });

    await expect(LoginPage()).rejects.toThrow("REDIRECT:/");
  });

  it("renders the sign-in form when not signed in", async () => {
    mockAuth.mockResolvedValue(null);

    const html = renderToStaticMarkup(await LoginPage());

    expect(html).toContain("GitHub로 로그인");
  });
});

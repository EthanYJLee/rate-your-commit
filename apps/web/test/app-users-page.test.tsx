import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  appUser: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { default: AppUsersSettingsPage } = await import("../app/settings/app-users/page");

function props(error?: string) {
  return { searchParams: Promise.resolve(error ? { error } : {}) };
}

describe("/settings/app-users page", () => {
  it("shows the empty state when no email/password accounts exist yet", async () => {
    mockPrisma.appUser.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await AppUsersSettingsPage(props()));

    expect(html).toContain("아직 발급된 계정이 없습니다");
  });

  it("lists each account by email with a revoke action, selecting only non-sensitive fields", async () => {
    mockPrisma.appUser.findMany.mockResolvedValue([
      { id: "user-1", email: "alice@example.com", createdAt: new Date("2026-01-01"), personId: null },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await AppUsersSettingsPage(props()));

    expect(html).toContain("alice@example.com");
    expect(html).toContain('action="/api/settings/app-users/user-1/revoke"');
    expect(mockPrisma.appUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, email: true, createdAt: true, personId: true } })
    );
  });

  it("renders the error message from the query param, when present", async () => {
    mockPrisma.appUser.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      await AppUsersSettingsPage(props("비밀번호는 최소 12자 이상이어야 합니다."))
    );

    expect(html).toContain("비밀번호는 최소 12자 이상이어야 합니다.");
  });

  it("shows a person-link dropdown per account, pre-selected to the linked person", async () => {
    mockPrisma.appUser.findMany.mockResolvedValue([
      { id: "user-1", email: "alice@example.com", createdAt: new Date("2026-01-01"), personId: "person-1" },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([{ id: "person-1", displayName: "Alice" }]);

    const html = renderToStaticMarkup(await AppUsersSettingsPage(props()));

    expect(html).toContain('action="/api/settings/app-users/user-1/person"');
    expect(html).toContain('value="person-1" selected');
    expect(html).toContain("— 미연결 —");
  });
});

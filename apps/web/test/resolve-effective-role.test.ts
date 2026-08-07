import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  appUser: { findUnique: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { resolveEffectiveRole } = await import("../lib/resolve-effective-role");

describe("resolveEffectiveRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_GITHUB_LOGINS;
  });

  it("returns member when there's no session user at all", async () => {
    expect(await resolveEffectiveRole(undefined)).toBe("member");
  });

  it("re-derives a GitHub session's role from ADMIN_GITHUB_LOGINS, not any cached value", async () => {
    process.env.ADMIN_GITHUB_LOGINS = "alice";

    expect(await resolveEffectiveRole({ provider: "github", login: "alice" })).toBe("admin");
    expect(await resolveEffectiveRole({ provider: "github", login: "carol" })).toBe("member");
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it("grandfathers a GitHub session to admin when ADMIN_GITHUB_LOGINS is unset", async () => {
    expect(await resolveEffectiveRole({ provider: "github", login: "carol" })).toBe("admin");
  });

  it("re-queries the AppUser row for a Credentials session's current role", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue({ role: "admin" });

    const role = await resolveEffectiveRole({ provider: "credentials", id: "user-1" });

    expect(role).toBe("admin");
    expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { role: true },
    });
  });

  it("treats a revoked (deleted) AppUser's Credentials session as member", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(null);

    expect(await resolveEffectiveRole({ provider: "credentials", id: "gone" })).toBe("member");
  });

  it("returns member for a Credentials session with no id", async () => {
    expect(await resolveEffectiveRole({ provider: "credentials" })).toBe("member");
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });
});

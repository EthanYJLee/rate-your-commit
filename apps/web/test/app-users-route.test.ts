import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  appUser: { create: vi.fn(), delete: vi.fn(), update: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { POST } = await import("../app/api/settings/app-users/route");
const { POST: revoke } = await import("../app/api/settings/app-users/[id]/revoke/route");
const { POST: linkPerson } = await import("../app/api/settings/app-users/[id]/person/route");

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/settings/app-users", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const VALID_PASSWORD = "correct-horse-battery-staple";

describe("POST /api/settings/app-users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an AppUser with a hashed password (never the plaintext) when input is valid", async () => {
    mockPrisma.appUser.create.mockResolvedValue({ id: "user-1", email: "alice@example.com" });

    const res = await POST(formRequest({ email: "Alice@Example.com", password: VALID_PASSWORD }));

    expect(res.status).toBe(303);
    expect(mockPrisma.appUser.create).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.appUser.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("alice@example.com");
    expect(createArgs.data.passwordHash).not.toContain(VALID_PASSWORD);
    expect(createArgs.data.passwordHash.split(":")).toHaveLength(2);
  });

  it("rejects a password shorter than the minimum length", async () => {
    const res = await POST(formRequest({ email: "alice@example.com", password: "short" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
    expect(mockPrisma.appUser.create).not.toHaveBeenCalled();
  });

  it("rejects a password longer than the maximum length", async () => {
    const res = await POST(formRequest({ email: "alice@example.com", password: "x".repeat(300) }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
    expect(mockPrisma.appUser.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const res = await POST(formRequest({ email: "not-an-email", password: VALID_PASSWORD }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
    expect(mockPrisma.appUser.create).not.toHaveBeenCalled();
  });

  it("responds with a friendly error when the email already has an account", async () => {
    mockPrisma.appUser.create.mockRejectedValue(new Error("Unique constraint failed"));

    const res = await POST(formRequest({ email: "alice@example.com", password: VALID_PASSWORD }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
  });
});

describe("POST /api/settings/app-users/[id]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the AppUser and redirects back to the settings page", async () => {
    mockPrisma.appUser.delete.mockResolvedValue({ id: "user-1" });

    const res = await revoke(
      new NextRequest("http://localhost/api/settings/app-users/user-1/revoke", { method: "POST" }),
      { params: Promise.resolve({ id: "user-1" }) }
    );

    expect(mockPrisma.appUser.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(res.status).toBe(303);
  });

  it("redirects with an error (not a 500) when the account no longer exists", async () => {
    mockPrisma.appUser.delete.mockRejectedValue(new Error("Record to delete does not exist."));

    const res = await revoke(
      new NextRequest("http://localhost/api/settings/app-users/gone/revoke", { method: "POST" }),
      { params: Promise.resolve({ id: "gone" }) }
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
  });
});

describe("POST /api/settings/app-users/[id]/person", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function personFormRequest(id: string, fields: Record<string, string>) {
    return new NextRequest(`http://localhost/api/settings/app-users/${id}/person`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }

  it("links the AppUser to the given personId", async () => {
    mockPrisma.appUser.update.mockResolvedValue({ id: "user-1", personId: "person-1" });

    const res = await linkPerson(personFormRequest("user-1", { personId: "person-1" }), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(mockPrisma.appUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { personId: "person-1" },
    });
    expect(res.status).toBe(303);
  });

  it("clears the link when personId is submitted empty", async () => {
    mockPrisma.appUser.update.mockResolvedValue({ id: "user-1", personId: null });

    await linkPerson(personFormRequest("user-1", { personId: "" }), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(mockPrisma.appUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { personId: null },
    });
  });
});

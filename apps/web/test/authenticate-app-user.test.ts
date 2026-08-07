import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../lib/password";

const mockPrisma = {
  appUser: { findUnique: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { authenticateAppUser } = await import("../lib/authenticate-app-user");
const { clearFailedAttempts } = await import("../lib/login-rate-limit");

describe("authenticateAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFailedAttempts("alice@example.com");
    clearFailedAttempts("nobody@example.com");
  });

  afterEach(() => {
    clearFailedAttempts("alice@example.com");
    clearFailedAttempts("nobody@example.com");
  });

  it("returns the user's id/email on a correct password", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "member",
    });

    const result = await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");

    expect(result).toEqual({
      id: "user-1",
      email: "alice@example.com",
      personId: null,
      role: "member",
    });
  });

  it("normalizes email case/whitespace before looking up", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "member",
    });

    await authenticateAppUser("  Alice@Example.com  ", "correct-horse-battery-staple");

    expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
  });

  it("returns null for a wrong password", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "member",
    });

    const result = await authenticateAppUser("alice@example.com", "totally-wrong");
    expect(result).toBeNull();
  });

  it("returns null when no account exists for that email", async () => {
    mockPrisma.appUser.findUnique.mockResolvedValue(null);

    const result = await authenticateAppUser("nobody@example.com", "whatever-password");
    expect(result).toBeNull();
  });

  it("records a failed attempt on wrong password and rate-limits after enough failures", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "member",
    });

    for (let i = 0; i < 5; i++) {
      await authenticateAppUser("alice@example.com", "wrong-password");
    }

    // Even the correct password is rejected once rate-limited.
    const result = await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");
    expect(result).toBeNull();
  });

  it("does not query the database at all once rate-limited", async () => {
    for (let i = 0; i < 5; i++) {
      await authenticateAppUser("alice@example.com", "wrong-password");
    }
    mockPrisma.appUser.findUnique.mockClear();

    await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");

    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });

  it("clears failed attempts on a successful login", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "member",
    });

    await authenticateAppUser("alice@example.com", "wrong-password");
    await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");

    // Not locked out — 4 more wrong attempts (would be #5-8 if the
    // count had carried over from before the successful login, which
    // would already exceed MAX_ATTEMPTS=5) still don't lock the
    // account, proving the earlier success reset the counter.
    for (let i = 0; i < 4; i++) {
      await authenticateAppUser("alice@example.com", "wrong-password");
    }
    const result = await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");
    expect(result).toEqual({
      id: "user-1",
      email: "alice@example.com",
      personId: null,
      role: "member",
    });
  });

  it("returns null (not throw) for a missing/empty email or password", async () => {
    expect(await authenticateAppUser("", "correct-horse-battery-staple")).toBeNull();
    expect(await authenticateAppUser("alice@example.com", "")).toBeNull();
  });

  it("returns the linked personId when an admin has connected this account to a Person", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: "person-1",
      role: "member",
    });

    const result = await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");

    expect(result?.personId).toBe("person-1");
  });

  it("returns the row's admin role when the account was provisioned as admin", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    mockPrisma.appUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      passwordHash,
      personId: null,
      role: "admin",
    });

    const result = await authenticateAppUser("alice@example.com", "correct-horse-battery-staple");

    expect(result?.role).toBe("admin");
  });

  it("rejects an oversized password before doing any DB lookup or hashing (CPU-exhaustion guard)", async () => {
    const result = await authenticateAppUser("alice@example.com", "x".repeat(1000));
    expect(result).toBeNull();
    expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawCommit, RawIdentity } from "@rateyourcommit/connectors";

const mockPrisma = {
  identity: { upsert: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  commit: { upsert: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { persist } = await import("../src/index");

function author(overrides: Partial<RawIdentity> = {}): RawIdentity {
  return { handle: "alice", email: "alice@example.com", ...overrides };
}

function commit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    sha: "abc123",
    authorHandle: "alice",
    authorEmail: "alice@example.com",
    message: "fix the thing",
    authoredAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.commit.upsert.mockResolvedValue({});
  });

  it("upserts an Identity by (handle, email) directly when the author has an email", async () => {
    mockPrisma.identity.upsert.mockResolvedValue({ id: "identity-1" });

    await persist("project-1", [author()], []);

    expect(mockPrisma.identity.upsert).toHaveBeenCalledWith({
      where: { handle_email: { handle: "alice", email: "alice@example.com" } },
      update: {},
      create: { handle: "alice", email: "alice@example.com" },
    });
    expect(mockPrisma.identity.findFirst).not.toHaveBeenCalled();
  });

  it("does NOT call upsert with a null email — Prisma's compound-unique shorthand rejects it at runtime for a nullable member (confirmed against a live Postgres); falls back to findFirst+create", async () => {
    mockPrisma.identity.findFirst.mockResolvedValue(null);
    mockPrisma.identity.create.mockResolvedValue({ id: "identity-2" });

    await persist("project-1", [author({ email: undefined })], []);

    expect(mockPrisma.identity.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.identity.findFirst).toHaveBeenCalledWith({
      where: { handle: "alice", email: null },
    });
    expect(mockPrisma.identity.create).toHaveBeenCalledWith({ data: { handle: "alice" } });
  });

  it("reuses an existing null-email Identity found via findFirst instead of creating a duplicate", async () => {
    mockPrisma.identity.findFirst.mockResolvedValue({ id: "existing-identity" });

    const { identityCount } = await persist("project-1", [author({ email: undefined })], []);

    expect(mockPrisma.identity.create).not.toHaveBeenCalled();
    expect(identityCount).toBe(1);
  });

  it("persists a commit linked to its author's Identity", async () => {
    mockPrisma.identity.upsert.mockResolvedValue({ id: "identity-1" });
    mockPrisma.commit.upsert.mockResolvedValue({});

    const { commitCount } = await persist("project-1", [author()], [commit()]);

    expect(commitCount).toBe(1);
    expect(mockPrisma.commit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_sha: { projectId: "project-1", sha: "abc123" } },
        create: expect.objectContaining({ identityId: "identity-1", projectId: "project-1" }),
      })
    );
  });

  it("skips a commit whose author isn't in the authors list (defensive, shouldn't happen in practice)", async () => {
    const { commitCount } = await persist(
      "project-1",
      [],
      [commit({ authorHandle: "unknown", authorEmail: undefined })]
    );

    expect(commitCount).toBe(0);
    expect(mockPrisma.commit.upsert).not.toHaveBeenCalled();
  });

  it("defaults missing additions/deletions to 0", async () => {
    mockPrisma.identity.upsert.mockResolvedValue({ id: "identity-1" });

    await persist("project-1", [author()], [commit({ additions: undefined, deletions: undefined })]);

    expect(mockPrisma.commit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ additions: 0, deletions: 0 }),
      })
    );
  });
});

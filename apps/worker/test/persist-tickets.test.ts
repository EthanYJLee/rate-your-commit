import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawTicket } from "@rateyourcommit/connectors";

const mockPrisma = {
  identity: { upsert: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  ticket: { upsert: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { persistTickets } = await import("../src/index");

function ticket(overrides: Partial<RawTicket> = {}): RawTicket {
  return {
    id: "1",
    title: "Fix the thing",
    status: "open",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("persistTickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.ticket.upsert.mockResolvedValue({});
  });

  it("upserts a ticket with no identity link when unassigned", async () => {
    const count = await persistTickets("project-1", [ticket()]);

    expect(count).toBe(1);
    expect(mockPrisma.identity.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.ticket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ identityId: undefined }),
      })
    );
  });

  it("resolves (or creates) an Identity keyed by (handle, email:null) for the assignee", async () => {
    // Not a plain upsert on the handle_email compound key: Prisma
    // rejects `null` there for a nullable compound-key member at
    // runtime (PrismaClientValidationError, confirmed against a live
    // Postgres) — see persist.test.ts for the fuller explanation.
    // findFirst-miss then create is the correct find-or-create here.
    mockPrisma.identity.findFirst.mockResolvedValue(null);
    mockPrisma.identity.create.mockResolvedValue({ id: "identity-1" });

    await persistTickets("project-1", [ticket({ assigneeHandle: "alice" })]);

    expect(mockPrisma.identity.findFirst).toHaveBeenCalledWith({
      where: { handle: "alice", email: null },
    });
    expect(mockPrisma.identity.create).toHaveBeenCalledWith({ data: { handle: "alice" } });
    expect(mockPrisma.ticket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ identityId: "identity-1" }),
        update: expect.objectContaining({ identityId: "identity-1" }),
      })
    );
  });

  it("reuses an existing null-email Identity for the assignee instead of creating a duplicate", async () => {
    mockPrisma.identity.findFirst.mockResolvedValue({ id: "existing-identity" });

    await persistTickets("project-1", [ticket({ assigneeHandle: "alice" })]);

    expect(mockPrisma.identity.create).not.toHaveBeenCalled();
    expect(mockPrisma.ticket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ identityId: "existing-identity" }),
      })
    );
  });
});

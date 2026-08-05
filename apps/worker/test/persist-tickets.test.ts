import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawTicket } from "@rateyourcommit/connectors";

const mockPrisma = {
  identity: { upsert: vi.fn() },
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
    expect(mockPrisma.identity.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.ticket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ identityId: undefined }),
      })
    );
  });

  it("resolves (or creates) an Identity keyed by (handle, email:null) for the assignee", async () => {
    mockPrisma.identity.upsert.mockResolvedValue({ id: "identity-1" });

    await persistTickets("project-1", [ticket({ assigneeHandle: "alice" })]);

    expect(mockPrisma.identity.upsert).toHaveBeenCalledWith({
      where: { handle_email: { handle: "alice", email: null } },
      update: {},
      create: { handle: "alice" },
    });
    expect(mockPrisma.ticket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ identityId: "identity-1" }),
        update: expect.objectContaining({ identityId: "identity-1" }),
      })
    );
  });
});

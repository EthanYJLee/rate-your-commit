import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  person: { updateMany: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { POST } = await import("../app/api/settings/teams/bulk-assign/route");

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/settings/teams/bulk-assign", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/settings/teams/bulk-assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    mockPrisma.person.update.mockResolvedValue({});
  });

  it("updates every submitted person's team in one transaction", async () => {
    const res = await POST(
      formRequest({ "team_person-1": "team-a", "team_person-2": "team-b" })
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { teamId: "team-a" },
    });
    expect(mockPrisma.person.update).toHaveBeenCalledWith({
      where: { id: "person-2" },
      data: { teamId: "team-b" },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/settings/teams");
  });

  it("clears a person's team when their field is submitted empty (— 미배정 —)", async () => {
    await POST(formRequest({ "team_person-1": "" }));

    expect(mockPrisma.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { teamId: null },
    });
  });

  it("ignores non-team_ form fields", async () => {
    await POST(formRequest({ "team_person-1": "team-a", unrelatedField: "x" }));

    expect(mockPrisma.person.update).toHaveBeenCalledTimes(1);
  });

  it("does nothing (still redirects) when no team_ fields are submitted", async () => {
    const res = await POST(formRequest({}));

    expect(mockPrisma.person.update).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });
});

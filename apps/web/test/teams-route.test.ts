import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  team: { create: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { POST } = await import("../app/api/settings/teams/route");

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings/teams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/settings/teams", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/settings/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a team when a name is given", async () => {
    mockPrisma.team.create.mockResolvedValue({ id: "team-1", name: "정산팀" });

    const res = await POST(jsonRequest({ name: "정산팀" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.team.create).toHaveBeenCalledWith({ data: { name: "정산팀" } });
    expect(body.team.id).toBe("team-1");
  });

  it("400s when name is blank", async () => {
    const res = await POST(jsonRequest({ name: "  " }));

    expect(res.status).toBe(400);
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });

  it("400s (with a friendly message) when the name already exists", async () => {
    mockPrisma.team.create.mockRejectedValue(new Error("Unique constraint failed"));

    const res = await POST(jsonRequest({ name: "정산팀" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("이미 존재");
  });

  it("redirects to /settings/teams with 303 on a successful form POST", async () => {
    mockPrisma.team.create.mockResolvedValue({ id: "team-2", name: "ERP팀" });

    const res = await POST(formRequest({ name: "ERP팀" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/settings/teams");
    expect(res.headers.get("location")).not.toContain("error=");
  });

  it("redirects with an error query param on a failed form POST", async () => {
    const res = await POST(formRequest({ name: "" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/settings/teams?error=");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  person: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { POST } = await import("../app/api/people/[id]/team/route");

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/people/person-1/team", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/people/person-1/team", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/people/[id]/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404s when the person does not exist", async () => {
    mockPrisma.person.findUnique.mockResolvedValue(null);

    const res = await POST(jsonRequest({ teamId: "team-1" }), paramsFor("missing"));

    expect(res.status).toBe(404);
    expect(mockPrisma.person.update).not.toHaveBeenCalled();
  });

  it("assigns the given teamId", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "person-1" });
    mockPrisma.person.update.mockResolvedValue({ id: "person-1", teamId: "team-1" });

    const res = await POST(jsonRequest({ teamId: "team-1" }), paramsFor("person-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { teamId: "team-1" },
    });
    expect(body.person.teamId).toBe("team-1");
  });

  it("clears the team when teamId is an empty string (미배정)", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "person-1" });
    mockPrisma.person.update.mockResolvedValue({ id: "person-1", teamId: null });

    await POST(jsonRequest({ teamId: "" }), paramsFor("person-1"));

    expect(mockPrisma.person.update).toHaveBeenCalledWith({
      where: { id: "person-1" },
      data: { teamId: null },
    });
  });

  it("redirects with 303 on a plain form POST instead of returning JSON", async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: "person-1" });
    mockPrisma.person.update.mockResolvedValue({ id: "person-1", teamId: "team-1" });

    const res = await POST(formRequest({ teamId: "team-1" }), paramsFor("person-1"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/settings/teams");
  });
});

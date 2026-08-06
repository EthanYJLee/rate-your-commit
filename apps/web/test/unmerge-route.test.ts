import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  identity: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockLogIdentityAction = vi.fn();

vi.mock("@rateyourcommit/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("../lib/audit-log", () => ({
  getActorLogin: vi.fn().mockResolvedValue("octocat"),
  logIdentityAction: mockLogIdentityAction,
}));

const { POST } = await import("../app/api/identities/[id]/unmerge/route");

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest() {
  return new NextRequest("http://localhost/api/identities/id-1/unmerge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

function formRequest() {
  return new NextRequest("http://localhost/api/identities/id-1/unmerge", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "",
  });
}

describe("POST /api/identities/[id]/unmerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404s when the identity does not exist", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue(null);

    const res = await POST(jsonRequest(), paramsFor("missing"));

    expect(res.status).toBe(404);
  });

  it("400s when the identity isn't merged into a person", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1", personId: null });

    const res = await POST(jsonRequest(), paramsFor("id-1"));

    expect(res.status).toBe(400);
    expect(mockPrisma.identity.update).not.toHaveBeenCalled();
  });

  it("clears personId, reverts status to pending, and logs the unmerge", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1", personId: "person-1" });
    mockPrisma.identity.update.mockResolvedValue({ id: "id-1", personId: null, status: "pending" });

    const res = await POST(jsonRequest(), paramsFor("id-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.identity.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { personId: null, status: "pending" },
    });
    expect(body.identity.status).toBe("pending");
    expect(mockLogIdentityAction).toHaveBeenCalledWith({
      action: "unmerge",
      identityId: "id-1",
      personId: null,
      previousPersonId: "person-1",
      actorLogin: "octocat",
    });
  });

  it("redirects with 303 on a plain form POST instead of returning JSON", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1", personId: "person-1" });
    mockPrisma.identity.update.mockResolvedValue({ id: "id-1", personId: null, status: "pending" });

    const res = await POST(formRequest(), paramsFor("id-1"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/identities");
  });
});

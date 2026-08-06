import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  identity: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  person: {
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
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

// Imported after the mocks so the route picks up the mocked modules.
const { POST } = await import("../app/api/identities/[id]/merge/route");

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/identities/id-1/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new NextRequest("http://localhost/api/identities/id-1/merge", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("POST /api/identities/[id]/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when neither personId nor newPersonName is provided", async () => {
    const res = await POST(jsonRequest({}), paramsFor("id-1"));

    expect(res.status).toBe(400);
    expect(mockPrisma.identity.findUnique).not.toHaveBeenCalled();
  });

  it("404s when the identity does not exist", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue(null);

    const res = await POST(jsonRequest({ newPersonName: "Alice" }), paramsFor("missing"));

    expect(res.status).toBe(404);
  });

  it("merges into an existing person via JSON body and returns JSON", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1", personId: null });
    mockPrisma.person.findUniqueOrThrow.mockResolvedValue({ id: "person-1", displayName: "Alice" });
    mockPrisma.identity.update.mockResolvedValue({
      id: "id-1",
      personId: "person-1",
      status: "confirmed",
    });

    const res = await POST(jsonRequest({ personId: "person-1" }), paramsFor("id-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.person.create).not.toHaveBeenCalled();
    expect(mockPrisma.identity.update).toHaveBeenCalledWith({
      where: { id: "id-1" },
      data: { personId: "person-1", status: "confirmed" },
    });
    expect(body.identity.status).toBe("confirmed");
    expect(mockLogIdentityAction).toHaveBeenCalledWith({
      action: "merge",
      identityId: "id-1",
      personId: "person-1",
      previousPersonId: null,
      actorLogin: "octocat",
    });
  });

  it("creates a new person when newPersonName is given instead of personId", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1" });
    mockPrisma.person.create.mockResolvedValue({ id: "person-2", displayName: "Bob" });
    mockPrisma.identity.update.mockResolvedValue({
      id: "id-1",
      personId: "person-2",
      status: "confirmed",
    });

    const res = await POST(jsonRequest({ newPersonName: "Bob" }), paramsFor("id-1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.person.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mockPrisma.person.create).toHaveBeenCalledWith({ data: { displayName: "Bob" } });
  });

  it("redirects with 303 on a plain form POST instead of returning JSON", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "id-1" });
    mockPrisma.person.create.mockResolvedValue({ id: "person-3", displayName: "Carol" });
    mockPrisma.identity.update.mockResolvedValue({
      id: "id-1",
      personId: "person-3",
      status: "confirmed",
    });

    const res = await POST(
      formRequest({ newPersonName: "Carol" }),
      paramsFor("id-1")
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/identities");
  });
});

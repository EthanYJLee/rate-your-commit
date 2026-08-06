import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  identity: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  commit: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
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

const { POST } = await import("../app/api/identities/[id]/split/route");

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/identities/shared-1/split", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new NextRequest("http://localhost/api/identities/shared-1/split", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("POST /api/identities/[id]/split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when tag is missing", async () => {
    const res = await POST(jsonRequest({}), paramsFor("shared-1"));

    expect(res.status).toBe(400);
    expect(mockPrisma.identity.findUnique).not.toHaveBeenCalled();
  });

  it("404s when the identity does not exist", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue(null);

    const res = await POST(jsonRequest({ tag: "개발자T" }), paramsFor("missing"));

    expect(res.status).toBe(404);
  });

  it("400s when the identity isn't a shared_account", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({ id: "shared-1", status: "confirmed" });

    const res = await POST(jsonRequest({ tag: "개발자T" }), paramsFor("shared-1"));

    expect(res.status).toBe(400);
    expect(mockPrisma.commit.findMany).not.toHaveBeenCalled();
  });

  it("400s when no commits match the tag", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({
      id: "shared-1",
      handle: "ci-bot",
      status: "shared_account",
    });
    mockPrisma.commit.findMany.mockResolvedValue([{ id: "c1", message: "no tag here" }]);

    const res = await POST(jsonRequest({ tag: "개발자T" }), paramsFor("shared-1"));

    expect(res.status).toBe(400);
    expect(mockPrisma.commit.updateMany).not.toHaveBeenCalled();
  });

  it("creates a new pending identity and reassigns just the tagged commits", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({
      id: "shared-1",
      handle: "ci-bot",
      status: "shared_account",
    });
    mockPrisma.commit.findMany.mockResolvedValue([
      { id: "c1", message: "[개발자T] fix" },
      { id: "c2", message: "[개발자T] another fix" },
      { id: "c3", message: "no tag" },
    ]);
    mockPrisma.identity.findFirst.mockResolvedValue(null);
    mockPrisma.identity.create.mockResolvedValue({ id: "new-1", handle: "개발자T", status: "pending" });

    const res = await POST(jsonRequest({ tag: "개발자T" }), paramsFor("shared-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.identity.create).toHaveBeenCalledWith({
      data: { handle: "개발자T", email: null, status: "pending" },
    });
    expect(mockPrisma.commit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] } },
      data: { identityId: "new-1" },
    });
    expect(body.movedCommits).toBe(2);
    expect(mockLogIdentityAction).toHaveBeenCalledWith({
      action: "split",
      identityId: "new-1",
      personId: null,
      previousPersonId: null,
      actorLogin: "octocat",
      note: "ci-bot에서 분리 (2건 커밋)",
    });
  });

  it("reuses an existing pending identity with the same handle instead of creating a duplicate", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({
      id: "shared-1",
      handle: "ci-bot",
      status: "shared_account",
    });
    mockPrisma.commit.findMany.mockResolvedValue([{ id: "c1", message: "[개발자T] fix" }]);
    mockPrisma.identity.findFirst.mockResolvedValue({ id: "existing-1", handle: "개발자T" });

    const res = await POST(jsonRequest({ tag: "개발자T" }), paramsFor("shared-1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.identity.create).not.toHaveBeenCalled();
    expect(mockPrisma.commit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1"] } },
      data: { identityId: "existing-1" },
    });
  });

  it("redirects with 303 on a plain form POST instead of returning JSON", async () => {
    mockPrisma.identity.findUnique.mockResolvedValue({
      id: "shared-1",
      handle: "ci-bot",
      status: "shared_account",
    });
    mockPrisma.commit.findMany.mockResolvedValue([{ id: "c1", message: "[개발자T] fix" }]);
    mockPrisma.identity.findFirst.mockResolvedValue({ id: "existing-1", handle: "개발자T" });

    const res = await POST(formRequest({ tag: "개발자T" }), paramsFor("shared-1"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/identities");
  });
});

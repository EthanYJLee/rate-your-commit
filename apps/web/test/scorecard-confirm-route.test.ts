import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  identity: { count: vi.fn() },
  scoreConfirmation: { create: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));
vi.mock("../lib/audit-log", () => ({
  getActorLogin: vi.fn().mockResolvedValue("octocat"),
}));

const { POST } = await import("../app/api/scorecard/confirm/route");

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/scorecard/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/scorecard/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ScoreConfirmation and redirects back to /scorecard when there are no unresolved identities", async () => {
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.scoreConfirmation.create.mockResolvedValue({});

    const res = await POST(formRequest({ period: "2023-03" }));

    expect(mockPrisma.scoreConfirmation.create).toHaveBeenCalledWith({
      data: {
        periodStart: new Date(Date.UTC(2023, 2, 1)),
        periodEnd: new Date(Date.UTC(2023, 3, 1)),
        confirmedByLogin: "octocat",
      },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/scorecard");
    expect(res.headers.get("location")).toContain("period=2023-03");
  });

  it("blocks confirmation and does not create a row when unresolved identities exist", async () => {
    mockPrisma.identity.count.mockResolvedValue(3);

    const res = await POST(formRequest({ period: "2023-03" }));

    expect(mockPrisma.scoreConfirmation.create).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects with an error rather than 500ing when the period is already confirmed", async () => {
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.scoreConfirmation.create.mockRejectedValue(new Error("Unique constraint failed"));

    const res = await POST(formRequest({ period: "2023-03" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("defaults to the current month when no period is given", async () => {
    mockPrisma.identity.count.mockResolvedValue(0);
    mockPrisma.scoreConfirmation.create.mockResolvedValue({});

    await POST(formRequest({}));

    expect(mockPrisma.scoreConfirmation.create).toHaveBeenCalledTimes(1);
  });
});

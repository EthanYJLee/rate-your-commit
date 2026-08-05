import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  scoreWeightConfig: { create: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({
  prisma: mockPrisma,
  DEFAULT_ORGANIZATION_ID: "default",
}));

const { POST } = await import("../app/api/settings/weights/route");

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings/weights", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/settings/weights", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/settings/weights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new ScoreWeightConfig row when weights sum to 100", async () => {
    mockPrisma.scoreWeightConfig.create.mockResolvedValue({ id: "cfg-1" });

    const res = await POST(
      jsonRequest({ delivery: 60, quality: 40, collaboration: 0, evaluation: 0 })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.scoreWeightConfig.create).toHaveBeenCalledWith({
      data: { organizationId: "default", delivery: 60, quality: 40, collaboration: 0, evaluation: 0 },
    });
    expect(body.config.id).toBe("cfg-1");
  });

  it("400s (JSON) when weights don't sum to 100", async () => {
    const res = await POST(
      jsonRequest({ delivery: 60, quality: 60, collaboration: 0, evaluation: 0 })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.scoreWeightConfig.create).not.toHaveBeenCalled();
  });

  it("400s when a field isn't a number", async () => {
    const res = await POST(
      jsonRequest({ delivery: "not-a-number", quality: 50, collaboration: 0, evaluation: 0 })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.scoreWeightConfig.create).not.toHaveBeenCalled();
  });

  it("redirects with an error query param (not a raw 400) on a form POST", async () => {
    const res = await POST(
      formRequest({ delivery: "60", quality: "60", collaboration: "0", evaluation: "0" })
    );

    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/settings/weights?error=");
  });

  it("redirects to the settings page with 303 on a successful form POST", async () => {
    mockPrisma.scoreWeightConfig.create.mockResolvedValue({ id: "cfg-2" });

    const res = await POST(
      formRequest({ delivery: "50", quality: "50", collaboration: "0", evaluation: "0" })
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/settings/weights");
    expect(res.headers.get("location")).not.toContain("error=");
  });
});

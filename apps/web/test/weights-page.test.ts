import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  scoreWeightConfig: { findFirst: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({
  prisma: mockPrisma,
  DEFAULT_ORGANIZATION_ID: "default",
}));

const { default: WeightSettingsPage } = await import("../app/settings/weights/page");

function props(error?: string) {
  return { searchParams: Promise.resolve(error ? { error } : {}) };
}

describe("/settings/weights page", () => {
  it("pre-fills the default 50/50/0/0 weights when no config exists yet", async () => {
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(null);

    const html = renderToStaticMarkup(await WeightSettingsPage(props()));

    expect(html).toContain('value="50"');
    expect(html).toContain('value="0"');
  });

  it("pre-fills the current effective weights when a config exists", async () => {
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue({
      delivery: 70,
      quality: 30,
      collaboration: 0,
      evaluation: 0,
      effectiveFrom: new Date("2026-02-01T00:00:00Z"),
    });

    const html = renderToStaticMarkup(await WeightSettingsPage(props()));

    expect(html).toContain('value="70"');
    expect(html).toContain('value="30"');
  });

  it("renders the error message from the query param, when present", async () => {
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await WeightSettingsPage(props("Axis weights must sum to 100, got 120."))
    );

    expect(html).toContain("Axis weights must sum to 100, got 120.");
  });

  it("shows no error block when there is no error query param", async () => {
    mockPrisma.scoreWeightConfig.findFirst.mockResolvedValue(null);

    const html = renderToStaticMarkup(await WeightSettingsPage(props()));

    expect(html).not.toContain("must sum to 100");
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  identity: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

// Imported after the mock so the page module picks up the mocked client.
const { default: IdentitiesPage } = await import("../app/identities/page");

describe("/identities page", () => {
  it("shows the empty-state hint when no identities have synced yet", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).toContain("아직 동기화된 데이터가 없습니다");
  });

  it("renders a merge form only for identities not yet linked to a Person", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "identity-pending",
        handle: "alice-h",
        email: "alice@example.com",
        status: "pending",
        person: null,
        _count: { commits: 3 },
      },
      {
        id: "identity-confirmed",
        handle: "bob-h",
        email: null,
        status: "confirmed",
        person: { id: "person-1", displayName: "Bob Real" },
        _count: { commits: 5 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([
      { id: "person-1", displayName: "Bob Real" },
    ]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    // Unresolved identity: handle shown, merge form present.
    expect(html).toContain("alice-h");
    expect(html).toContain('action="/api/identities/identity-pending/merge"');

    // Already-linked identity: person's display name shown, no merge form.
    expect(html).toContain("Bob Real");
    expect(html).not.toContain('action="/api/identities/identity-confirmed/merge"');
  });
});

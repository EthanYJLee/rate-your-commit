import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  identity: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
  commit: { findMany: vi.fn() },
  identityAuditLog: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

// Imported after the mock so the page module picks up the mocked client.
const { default: IdentitiesPage } = await import("../app/identities/page");

describe("/identities page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Most tests don't care about shared-account tags or audit
    // history — default both to empty so only the tests that do need
    // to override them.
    mockPrisma.commit.findMany.mockResolvedValue([]);
    mockPrisma.identityAuditLog.findMany.mockResolvedValue([]);
  });

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
        personId: null,
        person: null,
        _count: { commits: 3 },
      },
      {
        id: "identity-confirmed",
        handle: "bob-h",
        email: null,
        status: "confirmed",
        personId: "person-1",
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

  it("shows an S-07 match suggestion (exact email) and pre-selects the dropdown for it", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "identity-new",
        handle: "jane-personal-laptop",
        email: "jane@acme.com",
        status: "pending",
        personId: null,
        person: null,
        _count: { commits: 1 },
      },
      {
        id: "identity-linked",
        handle: "jane-dev",
        email: "jane@acme.com",
        status: "confirmed",
        personId: "person-jane",
        person: { id: "person-jane", displayName: "Jane Real" },
        _count: { commits: 10 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([
      { id: "person-jane", displayName: "Jane Real" },
    ]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).toContain("추천: Jane Real (이메일 완전일치)");
    expect(html).toContain(`value="person-jane" selected`);
  });

  it("shows no suggestion caption when nothing clears the match threshold", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "identity-new",
        handle: "totally-unrelated-handle",
        email: "nobody@example.com",
        status: "pending",
        personId: null,
        person: null,
        _count: { commits: 1 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).not.toContain("추천:");
  });

  it("shows an unmerge button only for identities already linked to a Person", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "identity-pending",
        handle: "alice-h",
        email: "alice@example.com",
        status: "pending",
        personId: null,
        person: null,
        _count: { commits: 3 },
      },
      {
        id: "identity-confirmed",
        handle: "bob-h",
        email: null,
        status: "confirmed",
        personId: "person-1",
        person: { id: "person-1", displayName: "Bob Real" },
        _count: { commits: 5 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([{ id: "person-1", displayName: "Bob Real" }]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).toContain('action="/api/identities/identity-confirmed/unmerge"');
    expect(html).not.toContain('action="/api/identities/identity-pending/unmerge"');
  });

  it("shows a tag breakdown with a split button for shared_account identities", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "shared-1",
        handle: "ci-bot",
        email: "ci@shared-runner.internal",
        status: "shared_account",
        personId: null,
        person: null,
        _count: { commits: 3 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([]);
    mockPrisma.commit.findMany.mockResolvedValueOnce([
      { id: "c1", message: "[개발자T] fix", identityId: "shared-1" },
      { id: "c2", message: "[개발자T] another fix", identityId: "shared-1" },
      { id: "c3", message: "no tag here", identityId: "shared-1" },
    ]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).toContain("개발자T");
    expect(html).toContain("2건");
    expect(html).toContain('action="/api/identities/shared-1/split"');
    expect(html).toContain('name="tag" value="개발자T"');
  });

  it("doesn't query commits or show a tag breakdown when there are no shared_account identities", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([
      {
        id: "identity-pending",
        handle: "alice-h",
        email: "alice@example.com",
        status: "pending",
        personId: null,
        person: null,
        _count: { commits: 3 },
      },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    await IdentitiesPage();

    expect(mockPrisma.commit.findMany).not.toHaveBeenCalled();
  });

  it("shows recent merge/unmerge/split history", async () => {
    mockPrisma.identity.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);
    mockPrisma.identityAuditLog.findMany.mockResolvedValueOnce([
      {
        id: "log-1",
        action: "split",
        actorLogin: "octocat",
        note: "ci-bot에서 분리 (2건 커밋)",
        createdAt: new Date(Date.UTC(2026, 7, 6, 3, 15)),
        identity: { handle: "개발자T" },
        person: null,
      },
      {
        id: "log-2",
        action: "merge",
        actorLogin: "octocat",
        note: null,
        createdAt: new Date(Date.UTC(2026, 7, 6, 3, 20)),
        identity: { handle: "개발자T" },
        person: { displayName: "김도윤" },
      },
    ]);

    const html = renderToStaticMarkup(await IdentitiesPage());

    expect(html).toContain("최근 병합/분리/해제 이력");
    expect(html).toContain("octocat");
    expect(html).toContain("김도윤");
    expect(html).toContain("ci-bot에서 분리");
  });
});

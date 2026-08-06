import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  team: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
};

vi.mock("@rateyourcommit/db", () => ({ prisma: mockPrisma }));

const { default: TeamSettingsPage } = await import("../app/settings/teams/page");

function props(error?: string) {
  return { searchParams: Promise.resolve(error ? { error } : {}) };
}

describe("/settings/teams page", () => {
  it("shows the empty state when no teams exist yet", async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await TeamSettingsPage(props()));

    expect(html).toContain("아직 등록된 팀이 없습니다");
  });

  it("lists each team with its member count", async () => {
    mockPrisma.team.findMany.mockResolvedValue([
      { id: "team-1", name: "정산팀", _count: { people: 3 } },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await TeamSettingsPage(props()));

    expect(html).toContain("정산팀");
    expect(html).toContain("3명");
  });

  it("shows a team-assignment dropdown per person, pre-selected to their current team", async () => {
    mockPrisma.team.findMany.mockResolvedValue([
      { id: "team-1", name: "정산팀", _count: { people: 1 } },
    ]);
    mockPrisma.person.findMany.mockResolvedValue([
      { id: "person-1", displayName: "Alice", teamId: "team-1", team: { id: "team-1", name: "정산팀" } },
      { id: "person-2", displayName: "Bob", teamId: null, team: null },
    ]);

    const html = renderToStaticMarkup(await TeamSettingsPage(props()));

    // One shared form (bulk save), not one form per row — each
    // person's <select> just carries a per-person name so the bulk
    // route can tell them apart.
    expect(html).toContain('action="/api/settings/teams/bulk-assign"');
    expect(html).toContain('name="team_person-1"');
    expect(html).toContain('value="team-1" selected');
    expect(html).toContain("미배정");
  });

  it("renders the error message from the query param, when present", async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);
    mockPrisma.person.findMany.mockResolvedValue([]);

    const html = renderToStaticMarkup(await TeamSettingsPage(props("이미 존재하는 팀 이름입니다.")));

    expect(html).toContain("이미 존재하는 팀 이름입니다.");
  });
});

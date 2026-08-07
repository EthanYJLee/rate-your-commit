import { describe, expect, it } from "vitest";
import { resolveGithubRole } from "../lib/admin-role";

describe("resolveGithubRole", () => {
  it("grandfathers any login to admin when the admin list is empty (ADMIN_GITHUB_LOGINS unset)", () => {
    expect(resolveGithubRole("alice", [])).toBe("admin");
  });

  it("grants admin to a login present in a configured admin list", () => {
    expect(resolveGithubRole("alice", ["alice", "bob"])).toBe("admin");
  });

  it("demotes a login not present in a configured admin list to member", () => {
    expect(resolveGithubRole("carol", ["alice", "bob"])).toBe("member");
  });

  it("matches case-insensitively, same as isLoginAllowed", () => {
    expect(resolveGithubRole("Alice", ["alice"])).toBe("admin");
  });

  it("returns member when a configured list exists but no login is provided", () => {
    expect(resolveGithubRole(undefined, ["alice", "bob"])).toBe("member");
  });
});

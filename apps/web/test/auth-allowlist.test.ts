import { describe, expect, it } from "vitest";
import { isLoginAllowed, parseAllowedLogins } from "../lib/auth-allowlist";

describe("parseAllowedLogins", () => {
  it("splits a comma-separated list, trimming whitespace and lowercasing", () => {
    expect(parseAllowedLogins(" Alice, bob ,CarolDev")).toEqual(["alice", "bob", "caroldev"]);
  });

  it("returns an empty list for undefined or blank input", () => {
    expect(parseAllowedLogins(undefined)).toEqual([]);
    expect(parseAllowedLogins("")).toEqual([]);
    expect(parseAllowedLogins("  ")).toEqual([]);
  });

  it("drops empty entries from stray commas", () => {
    expect(parseAllowedLogins("alice,,bob,")).toEqual(["alice", "bob"]);
  });
});

describe("isLoginAllowed", () => {
  it("allows a login present in the list, case-insensitively", () => {
    expect(isLoginAllowed("Alice", ["alice", "bob"])).toBe(true);
  });

  it("denies a login not in the list", () => {
    expect(isLoginAllowed("mallory", ["alice", "bob"])).toBe(false);
  });

  it("fails closed when the allowlist is empty, even for a real login", () => {
    expect(isLoginAllowed("alice", [])).toBe(false);
  });

  it("denies when no login is provided at all", () => {
    expect(isLoginAllowed(undefined, ["alice"])).toBe(false);
  });
});

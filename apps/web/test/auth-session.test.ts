import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { attachLoginToSession, attachLoginToToken } from "../lib/auth-session";

describe("attachLoginToToken", () => {
  it("copies profile.login onto the token", () => {
    const token = attachLoginToToken({}, { login: "octocat" });
    expect(token.login).toBe("octocat");
  });

  it("leaves the token unchanged when profile is undefined (no fresh sign-in this request)", () => {
    const token = attachLoginToToken({ login: "octocat" }, undefined);
    expect(token.login).toBe("octocat");
  });

  it("leaves the token unchanged when profile has no login", () => {
    const token = attachLoginToToken({ login: "octocat" }, {});
    expect(token.login).toBe("octocat");
  });

  it("does not mutate the input token", () => {
    const original = {};
    attachLoginToToken(original, { login: "octocat" });
    expect(original).toEqual({});
  });
});

describe("attachLoginToSession", () => {
  it("copies token.login onto session.user", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "octocat" },
    );
    expect(session.user?.login).toBe("octocat");
    expect(session.user?.name).toBe("Alice");
  });

  it("leaves the session unchanged when the token has no login", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      {},
    );
    expect(session.user?.login).toBeUndefined();
  });

  it("leaves the session unchanged when there's no user on it", () => {
    // Cast past the type's `user` requirement — defends against a
    // malformed/edge-case session shape at runtime, not something the
    // types are expected to allow constructing normally.
    const session = attachLoginToSession(
      { expires: "2099-01-01" } as Session,
      { login: "octocat" },
    );
    expect(session.user).toBeUndefined();
  });

  it("does not mutate the input session", () => {
    const original = { user: { name: "Alice" }, expires: "2099-01-01" };
    attachLoginToSession(original, { login: "octocat" });
    expect(original.user).toEqual({ name: "Alice" });
  });
});

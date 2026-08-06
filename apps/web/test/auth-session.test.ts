import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { attachLoginToSession, attachLoginToToken, attachPersonIdToToken } from "../lib/auth-session";

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

  it("falls back to the user's email when there's no GitHub profile.login (Credentials sign-in)", () => {
    const token = attachLoginToToken({}, undefined, { email: "alice@example.com" });
    expect(token.login).toBe("alice@example.com");
  });

  it("prefers profile.login over the user's email when both are present", () => {
    const token = attachLoginToToken({}, { login: "octocat" }, { email: "octocat@example.com" });
    expect(token.login).toBe("octocat");
  });

  it("leaves the token unchanged when neither profile.login nor user.email is present", () => {
    const token = attachLoginToToken({ login: "octocat" }, undefined, {});
    expect(token.login).toBe("octocat");
  });
});

describe("attachPersonIdToToken", () => {
  it("copies user.personId onto the token", () => {
    const token = attachPersonIdToToken({}, { personId: "person-1" });
    expect(token.personId).toBe("person-1");
  });

  it("leaves the token unchanged when user.personId is null (unlinked AppUser)", () => {
    const token = attachPersonIdToToken({}, { personId: null });
    expect(token.personId).toBeUndefined();
  });

  it("leaves the token unchanged when user is undefined (GitHub sign-in has no personId concept)", () => {
    const token = attachPersonIdToToken({ personId: "person-1" }, undefined);
    expect(token.personId).toBe("person-1");
  });

  it("does not mutate the input token", () => {
    const original = {};
    attachPersonIdToToken(original, { personId: "person-1" });
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

  it("copies token.personId onto session.user (linked AppUser)", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "alice@example.com", personId: "person-1" },
    );
    expect(session.user?.personId).toBe("person-1");
  });

  it("leaves session.user.personId undefined when the token has none (GitHub sign-in, or an unlinked AppUser)", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "octocat" },
    );
    expect(session.user?.personId).toBeUndefined();
  });
});

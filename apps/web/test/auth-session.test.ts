import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  attachLoginToSession,
  attachLoginToToken,
  attachPersonIdToToken,
  attachProviderToToken,
  attachRoleToToken,
} from "../lib/auth-session";

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

describe("attachRoleToToken", () => {
  it("computes the role from GitHub's admin-login list on a fresh GitHub sign-in", () => {
    const token = attachRoleToToken({}, { login: "alice" }, undefined, ["alice"]);
    expect(token.role).toBe("admin");
  });

  it("demotes a GitHub login not in the admin list to member", () => {
    const token = attachRoleToToken({}, { login: "carol" }, undefined, ["alice"]);
    expect(token.role).toBe("member");
  });

  it("grandfathers a GitHub login to admin when the admin list is empty", () => {
    const token = attachRoleToToken({}, { login: "carol" }, undefined, []);
    expect(token.role).toBe("admin");
  });

  it("uses the AppUser's own role on a fresh Credentials sign-in", () => {
    const token = attachRoleToToken({}, undefined, { role: "member" }, ["alice"]);
    expect(token.role).toBe("member");
  });

  it("prefers the GitHub profile branch over user.role when both are present", () => {
    const token = attachRoleToToken({}, { login: "alice" }, { role: "member" }, ["alice"]);
    expect(token.role).toBe("admin");
  });

  it("leaves an existing token's role untouched when neither profile nor user is present (session refresh)", () => {
    const token = attachRoleToToken({ role: "admin" }, undefined, undefined, []);
    expect(token.role).toBe("admin");
  });

  it("does not mutate the input token", () => {
    const original = {};
    attachRoleToToken(original, { login: "alice" }, undefined, ["alice"]);
    expect(original).toEqual({});
  });
});

describe("attachProviderToToken", () => {
  it("records github on a fresh GitHub sign-in", () => {
    const token = attachProviderToToken({}, { provider: "github" });
    expect(token.provider).toBe("github");
  });

  it("records credentials on a fresh Credentials sign-in", () => {
    const token = attachProviderToToken({}, { provider: "credentials" });
    expect(token.provider).toBe("credentials");
  });

  it("leaves the token unchanged when account is undefined (session refresh, not a fresh sign-in)", () => {
    const token = attachProviderToToken({ provider: "github" }, undefined);
    expect(token.provider).toBe("github");
  });

  it("ignores an unrecognized provider value", () => {
    const token = attachProviderToToken({}, { provider: "some-other-provider" });
    expect(token.provider).toBeUndefined();
  });

  it("does not mutate the input token", () => {
    const original = {};
    attachProviderToToken(original, { provider: "github" });
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

  it("copies token.role onto session.user", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "octocat", role: "admin" },
    );
    expect(session.user?.role).toBe("admin");
  });

  it("leaves session.user.role undefined when the token has none", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "octocat" },
    );
    expect(session.user?.role).toBeUndefined();
  });

  it("copies token.provider and token.sub (as user.id) onto session.user", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "alice@example.com", provider: "credentials", sub: "user-1" },
    );
    expect(session.user?.provider).toBe("credentials");
    expect(session.user?.id).toBe("user-1");
  });

  it("leaves session.user.provider/id undefined when the token has neither", () => {
    const session = attachLoginToSession(
      { user: { name: "Alice" }, expires: "2099-01-01" },
      { login: "octocat" },
    );
    expect(session.user?.provider).toBeUndefined();
    expect(session.user?.id).toBeUndefined();
  });
});

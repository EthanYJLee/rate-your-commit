import { describe, expect, it } from "vitest";
import { isAdminOnlyPath, isMutatingMethod, isOriginValid } from "../lib/request-guard";

describe("isAdminOnlyPath", () => {
  it("gates the identities page and its drill-down routes", () => {
    expect(isAdminOnlyPath("/identities")).toBe(true);
  });

  it("gates every /settings/* page", () => {
    expect(isAdminOnlyPath("/settings/weights")).toBe(true);
    expect(isAdminOnlyPath("/settings/teams")).toBe(true);
    expect(isAdminOnlyPath("/settings/app-users")).toBe(true);
  });

  it("gates the matching /api/* mutating routes", () => {
    expect(isAdminOnlyPath("/api/identities/id-1/merge")).toBe(true);
    expect(isAdminOnlyPath("/api/settings/teams")).toBe(true);
    expect(isAdminOnlyPath("/api/settings/teams/bulk-assign")).toBe(true);
    expect(isAdminOnlyPath("/api/people/id-1/team")).toBe(true);
    expect(isAdminOnlyPath("/api/scorecard/confirm")).toBe(true);
  });

  it("leaves the dashboard and scorecard open to anyone signed in", () => {
    expect(isAdminOnlyPath("/")).toBe(false);
    expect(isAdminOnlyPath("/scorecard")).toBe(false);
    expect(isAdminOnlyPath("/scorecard/person-1")).toBe(false);
  });

  it("does not false-positive on a path that merely starts with the same letters", () => {
    expect(isAdminOnlyPath("/settingsomething")).toBe(false);
    expect(isAdminOnlyPath("/identitiesfoo")).toBe(false);
  });
});

describe("isMutatingMethod", () => {
  it("treats GET/HEAD/OPTIONS as safe", () => {
    expect(isMutatingMethod("GET")).toBe(false);
    expect(isMutatingMethod("HEAD")).toBe(false);
    expect(isMutatingMethod("OPTIONS")).toBe(false);
    expect(isMutatingMethod("get")).toBe(false);
  });

  it("treats POST/PUT/PATCH/DELETE as mutating", () => {
    expect(isMutatingMethod("POST")).toBe(true);
    expect(isMutatingMethod("PUT")).toBe(true);
    expect(isMutatingMethod("PATCH")).toBe(true);
    expect(isMutatingMethod("DELETE")).toBe(true);
  });
});

describe("isOriginValid", () => {
  it("accepts a same-origin request", () => {
    expect(isOriginValid("https://app.example.com", "https://app.example.com")).toBe(true);
  });

  it("rejects a cross-origin request", () => {
    expect(isOriginValid("https://evil.example.com", "https://app.example.com")).toBe(false);
  });

  it("rejects a missing Origin header rather than allowing it", () => {
    expect(isOriginValid(null, "https://app.example.com")).toBe(false);
  });
});

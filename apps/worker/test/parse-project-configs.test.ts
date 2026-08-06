import { describe, expect, it } from "vitest";
import { parseProjectConfigs } from "../src/parseProjectConfigs";

describe("parseProjectConfigs", () => {
  it("returns an empty list when SYNC_PROJECTS is unset", () => {
    expect(parseProjectConfigs(undefined)).toEqual([]);
  });

  it("returns an empty list when SYNC_PROJECTS is an empty string", () => {
    expect(parseProjectConfigs("")).toEqual([]);
  });

  it("parses a github entry", () => {
    const raw = JSON.stringify([{ connector: "github", owner: "acme", repo: "widgets" }]);
    expect(parseProjectConfigs(raw)).toEqual([
      { connector: "github", owner: "acme", repo: "widgets" },
    ]);
  });

  it("parses a gitlab entry with an optional baseUrl", () => {
    const raw = JSON.stringify([
      { connector: "gitlab", projectPath: "group/project", baseUrl: "https://gitlab.example.com" },
    ]);
    expect(parseProjectConfigs(raw)).toEqual([
      { connector: "gitlab", projectPath: "group/project", baseUrl: "https://gitlab.example.com" },
    ]);
  });

  it("parses a gitlab entry without baseUrl (defaults handled by the connector, not here)", () => {
    const raw = JSON.stringify([{ connector: "gitlab", projectPath: "group/project" }]);
    expect(parseProjectConfigs(raw)).toEqual([
      { connector: "gitlab", projectPath: "group/project" },
    ]);
  });

  it("parses a jira entry", () => {
    const raw = JSON.stringify([
      { connector: "jira", baseUrl: "https://acme.atlassian.net", projectKey: "OP" },
    ]);
    expect(parseProjectConfigs(raw)).toEqual([
      { connector: "jira", baseUrl: "https://acme.atlassian.net", projectKey: "OP" },
    ]);
  });

  it("parses a linear entry", () => {
    const raw = JSON.stringify([{ connector: "linear", teamKey: "ENG" }]);
    expect(parseProjectConfigs(raw)).toEqual([{ connector: "linear", teamKey: "ENG" }]);
  });

  it("parses multiple mixed entries, preserving order", () => {
    const raw = JSON.stringify([
      { connector: "github", owner: "acme", repo: "widgets" },
      { connector: "linear", teamKey: "ENG" },
    ]);
    expect(parseProjectConfigs(raw)).toEqual([
      { connector: "github", owner: "acme", repo: "widgets" },
      { connector: "linear", teamKey: "ENG" },
    ]);
  });

  it("throws a clear error when SYNC_PROJECTS is not valid JSON", () => {
    expect(() => parseProjectConfigs("{not json")).toThrow(/SYNC_PROJECTS/);
  });

  it("throws a clear error when SYNC_PROJECTS is valid JSON but not an array", () => {
    expect(() => parseProjectConfigs(JSON.stringify({ connector: "github" }))).toThrow(
      /SYNC_PROJECTS/
    );
  });

  it("throws a clear error when an entry has an unknown connector value", () => {
    const raw = JSON.stringify([{ connector: "bitbucket", owner: "x", repo: "y" }]);
    expect(() => parseProjectConfigs(raw)).toThrow(/bitbucket/);
  });

  it("throws a clear error when a github entry is missing a required field", () => {
    const raw = JSON.stringify([{ connector: "github", owner: "acme" }]);
    expect(() => parseProjectConfigs(raw)).toThrow(/repo/);
  });

  it("throws a clear error when a jira entry is missing a required field", () => {
    const raw = JSON.stringify([{ connector: "jira", baseUrl: "https://acme.atlassian.net" }]);
    expect(() => parseProjectConfigs(raw)).toThrow(/projectKey/);
  });
});

/**
 * Multi-source sync config, read from the SYNC_PROJECTS env var (a
 * JSON array — see .env.example). Replaces the old single-project
 * GITHUB_TOKEN/GITHUB_REPOSITORY pair; there are no real deployments
 * to stay backward-compatible with yet (see docs/rate_your_commit
 * memory "Before real use"), so this is a clean cutover rather than
 * two parallel config paths.
 *
 * Per-connector-type credentials (GITHUB_TOKEN, GITLAB_TOKEN,
 * JIRA_EMAIL/JIRA_API_TOKEN, LINEAR_API_KEY) stay in their own env
 * vars rather than inline in this JSON, same reasoning GITHUB_TOKEN
 * always had: secrets don't belong mixed into a config blob that
 * might get logged or committed. One credential set is shared across
 * every configured project of that connector type — this tool is
 * built for a single org's own projects, not multi-tenant hosting.
 *
 * Scope decision (confirmed with the user): source and tracker must
 * come from the SAME platform for a given project entry — e.g. a
 * "github" entry pairs GitHubConnector (commits) with
 * GitHubIssuesConnector (issues), matching today's behavior exactly.
 * Cross-platform pairing (e.g. GitLab commits + Jira tickets as one
 * logical project) is out of scope; each entry maps to exactly one
 * Project row identified by (connector, externalRef).
 */
export type ProjectConfig =
  | { connector: "github"; owner: string; repo: string }
  | { connector: "gitlab"; projectPath: string; baseUrl?: string }
  | { connector: "jira"; baseUrl: string; projectKey: string }
  | { connector: "linear"; teamKey: string };

const REQUIRED_FIELDS: Record<ProjectConfig["connector"], string[]> = {
  github: ["owner", "repo"],
  gitlab: ["projectPath"],
  jira: ["baseUrl", "projectKey"],
  linear: ["teamKey"],
};

function assertValidEntry(entry: unknown, index: number): asserts entry is ProjectConfig {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`SYNC_PROJECTS[${index}] must be an object.`);
  }

  const connector = (entry as { connector?: unknown }).connector;
  if (typeof connector !== "string" || !(connector in REQUIRED_FIELDS)) {
    throw new Error(
      `SYNC_PROJECTS[${index}].connector must be one of ${Object.keys(REQUIRED_FIELDS).join(
        ", "
      )}, got ${JSON.stringify(connector)}.`
    );
  }

  const missing = REQUIRED_FIELDS[connector as ProjectConfig["connector"]].filter(
    (field) => typeof (entry as Record<string, unknown>)[field] !== "string"
  );
  if (missing.length > 0) {
    throw new Error(
      `SYNC_PROJECTS[${index}] (connector: "${connector}") is missing required field(s): ${missing.join(", ")}.`
    );
  }
}

/**
 * Parses and validates the SYNC_PROJECTS env var. Throws with a clear
 * message (naming SYNC_PROJECTS, the offending index, and the
 * offending field) on malformed input — config errors here would
 * otherwise surface as a confusing runtime failure deep inside a
 * connector, so this validates at the boundary instead (same
 * philosophy as the rest of this codebase's input validation).
 */
export function parseProjectConfigs(raw: string | undefined): ProjectConfig[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`SYNC_PROJECTS is not valid JSON: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("SYNC_PROJECTS must be a JSON array of project config objects.");
  }

  parsed.forEach((entry, index) => assertValidEntry(entry, index));
  return parsed as ProjectConfig[];
}

/**
 * Sync worker entrypoint. Fetches commits/authors via
 * packages/connectors and logs a summary.
 *
 * NOTE: this does not persist to packages/db yet — that wiring is a
 * separate, later step (see docs/ARCHITECTURE.md §3). Today this only
 * proves the GitHub connector runs against a real repo end to end.
 */
import { GitHubConnector } from "@rateyourcommit/connectors";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runSync(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY; // "owner/repo"

  if (!token || !repoSlug) {
    console.log(
      `[worker] sync tick at ${new Date().toISOString()} — GITHUB_TOKEN/GITHUB_REPOSITORY not set, skipping`
    );
    return;
  }

  const [owner, repo] = repoSlug.split("/");
  const connector = new GitHubConnector({ owner, repo, token });

  console.log(`[worker] syncing ${owner}/${repo}...`);
  try {
    const [authors, commits] = await Promise.all([
      connector.fetchAuthors(),
      connector.fetchCommits(new Date(0)), // full history — see docs/ARCHITECTURE.md decision log
    ]);
    console.log(
      `[worker] fetched ${authors.length} distinct authors, ${commits.length} commits ` +
        `(not yet persisted — packages/db wiring is a later step)`
    );
  } catch (err) {
    console.error("[worker] sync failed:", err);
  }
}

async function main(): Promise<void> {
  console.log("[worker] RateYourCommit sync worker starting (v0.0.1)");
  await runSync();
  setInterval(runSync, SYNC_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});

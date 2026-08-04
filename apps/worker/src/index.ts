/**
 * Sync worker entrypoint. In v1.0 this will loop over configured
 * SourceConnector/TrackerConnector instances (packages/connectors)
 * and persist normalized rows via packages/db.
 *
 * No connector implementations exist yet (see docs/ARCHITECTURE.md §2
 * for the v1.0 priority order), so runSync is an honest no-op for now
 * rather than a stub that pretends to talk to GitHub.
 */

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runSync(): Promise<void> {
  console.log(
    `[worker] sync tick at ${new Date().toISOString()} — no connectors configured yet`
  );
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

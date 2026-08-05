/**
 * Sync worker entrypoint. Fetches commits/authors/tickets via
 * packages/connectors and persists them via packages/db.
 *
 * Persistence model per sync tick:
 *   1. Upsert the Project row for this connector+repo.
 *   2. Upsert an Identity row per distinct author (unresolved by
 *      default — see docs/ARCHITECTURE.md §3 / screen S-07. Nothing
 *      here auto-links an Identity to a Person; that's a human
 *      decision made in the S-07 UI).
 *   3. Upsert a Commit row per commit, linked to its Identity.
 *   4. Upsert a Ticket row per GitHub issue (PRs excluded — see
 *      packages/connectors/src/github/issues.ts). Not yet consumed by
 *      any scoring/aggregation code; this just lands the raw data.
 */
import { GitHubConnector, GitHubIssuesConnector } from "@rateyourcommit/connectors";
import type { RawIdentity, RawTicket } from "@rateyourcommit/connectors";
import { prisma } from "@rateyourcommit/db";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function identityKey(identity: Pick<RawIdentity, "handle" | "email">): string {
  return `${identity.handle}::${identity.email ?? ""}`;
}

async function persist(
  projectId: string,
  authors: RawIdentity[],
  commits: Awaited<ReturnType<GitHubConnector["fetchCommits"]>>
): Promise<{ identityCount: number; commitCount: number }> {
  const identityIdByKey = new Map<string, string>();

  for (const author of authors) {
    const identity = await prisma.identity.upsert({
      where: { handle_email: { handle: author.handle, email: author.email ?? null } },
      update: {},
      create: { handle: author.handle, email: author.email },
    });
    identityIdByKey.set(identityKey(author), identity.id);
  }

  let commitCount = 0;
  for (const commit of commits) {
    const key = identityKey({ handle: commit.authorHandle, email: commit.authorEmail });
    const identityId = identityIdByKey.get(key);
    if (!identityId) {
      // Author wasn't in fetchAuthors()'s dedup set — shouldn't happen
      // since both derive from the same commit list, but skip safely.
      continue;
    }

    await prisma.commit.upsert({
      where: { projectId_sha: { projectId, sha: commit.sha } },
      update: {},
      create: {
        sha: commit.sha,
        message: commit.message,
        additions: commit.additions ?? 0,
        deletions: commit.deletions ?? 0,
        authoredAt: commit.authoredAt,
        identityId,
        projectId,
      },
    });
    commitCount += 1;
  }

  return { identityCount: identityIdByKey.size, commitCount };
}

async function persistTickets(projectId: string, tickets: RawTicket[]): Promise<number> {
  for (const ticket of tickets) {
    await prisma.ticket.upsert({
      where: { projectId_externalId: { projectId, externalId: ticket.id } },
      update: { title: ticket.title, status: ticket.status, closedAt: ticket.closedAt },
      create: {
        externalId: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
        closedAt: ticket.closedAt,
        projectId,
      },
    });
  }

  return tickets.length;
}

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
  const issuesConnector = new GitHubIssuesConnector({ owner, repo, token });

  console.log(`[worker] syncing ${owner}/${repo}...`);
  try {
    const project = await prisma.project.upsert({
      where: { connectorId_externalRef: { connectorId: "github", externalRef: repoSlug } },
      update: {},
      create: { name: repoSlug, connectorId: "github", externalRef: repoSlug },
    });

    const [authors, commits, tickets] = await Promise.all([
      connector.fetchAuthors(),
      connector.fetchCommits(new Date(0)), // full history — see docs/ARCHITECTURE.md decision log
      issuesConnector.fetchTickets(new Date(0)), // full history, same rationale
    ]);

    const { identityCount, commitCount } = await persist(project.id, authors, commits);
    const ticketCount = await persistTickets(project.id, tickets);

    console.log(
      `[worker] synced ${owner}/${repo}: ${identityCount} identities, ${commitCount} commits, ` +
        `${ticketCount} tickets persisted`
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

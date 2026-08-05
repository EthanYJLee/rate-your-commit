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
 *   5. S-04: fetch weekly per-author contributor stats, run them
 *      through packages/metrics#detectOutlierWeeks, and flag every
 *      Commit in a flagged author-week as excluded (see that
 *      package's docstring for why the grain is "author-week", not
 *      "single commit").
 *   6. S-02: recompute a ScoreResult for every Person with any
 *      tracked activity, for the current calendar month. Idempotent
 *      upsert, so re-running mid-month just refreshes the same
 *      snapshot (see ScoreResult's schema comment).
 */
import { GitHubConnector, GitHubIssuesConnector } from "@rateyourcommit/connectors";
import type { RawIdentity, RawTicket } from "@rateyourcommit/connectors";
import { computeAxisMetrics, currentMonthPeriod, detectOutlierWeeks } from "@rateyourcommit/metrics";
import type { OutlierWeek } from "@rateyourcommit/metrics";
import { assignGrade, calculateScore } from "@rateyourcommit/scoring";
import type { AxisWeights } from "@rateyourcommit/scoring";
import { DEFAULT_ORGANIZATION_ID, prisma } from "@rateyourcommit/db";

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

/**
 * Resolves (or creates) the Identity for a ticket's assignee, keyed
 * by (handle, email: null) — the same dedup key `persist()` uses for
 * commit authors. A person can end up with more than one Identity row
 * this way (e.g. one from commits with a real email, one from
 * ticket-assignee with a null email) — that's the same identity
 * fragmentation S-07's merge screen already exists to resolve
 * manually, not a new problem this introduces.
 */
async function resolveAssigneeIdentityId(handle: string | undefined): Promise<string | undefined> {
  if (!handle) return undefined;

  const identity = await prisma.identity.upsert({
    where: { handle_email: { handle, email: null } },
    update: {},
    create: { handle },
  });
  return identity.id;
}

export async function persistTickets(projectId: string, tickets: RawTicket[]): Promise<number> {
  for (const ticket of tickets) {
    const identityId = await resolveAssigneeIdentityId(ticket.assigneeHandle);

    await prisma.ticket.upsert({
      where: { projectId_externalId: { projectId, externalId: ticket.id } },
      update: { title: ticket.title, status: ticket.status, closedAt: ticket.closedAt, identityId },
      create: {
        externalId: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
        closedAt: ticket.closedAt,
        identityId,
        projectId,
      },
    });
  }

  return tickets.length;
}

/**
 * Applies S-04 outlier-week flags to every Commit an author made
 * within a flagged week. Matches by Identity.handle rather than a
 * single identityId, since one GitHub login can legitimately map to
 * more than one Identity row (different commit-author emails).
 * Exported for unit testing.
 */
export async function applyOutlierFlags(
  projectId: string,
  outlierWeeks: OutlierWeek[]
): Promise<number> {
  let flaggedCount = 0;

  for (const week of outlierWeeks) {
    const identities = await prisma.identity.findMany({
      where: { handle: week.authorHandle },
      select: { id: true },
    });
    if (identities.length === 0) continue;

    const result = await prisma.commit.updateMany({
      where: {
        projectId,
        identityId: { in: identities.map((identity) => identity.id) },
        authoredAt: { gte: week.weekStart, lt: week.weekEnd },
      },
      data: { excludedFlag: true, excludedReason: week.reason },
    });
    flaggedCount += result.count;
  }

  return flaggedCount;
}

/**
 * Fetches the org's current weights, creating a default config
 * (delivery/quality split evenly, collaboration/evaluation at 0 since
 * neither has a real data source yet — see packages/metrics#
 * UNIMPLEMENTED_AXIS_PLACEHOLDER) the first time this ever runs.
 */
async function getOrCreateWeightConfig(): Promise<AxisWeights> {
  const existing = await prisma.scoreWeightConfig.findFirst({
    where: { organizationId: DEFAULT_ORGANIZATION_ID },
    orderBy: { effectiveFrom: "desc" },
  });
  if (existing) return existing;

  return prisma.scoreWeightConfig.create({
    data: {
      organizationId: DEFAULT_ORGANIZATION_ID,
      delivery: 50,
      quality: 50,
      collaboration: 0,
      evaluation: 0,
    },
  });
}

/**
 * Recomputes and upserts this month's ScoreResult for every Person
 * with any tracked activity (skips people with zero commits/tickets
 * ever — nothing to score yet, not "scored 100/S by default").
 * Aggregates across ALL of a person's linked Identities, since one
 * person can have more than one (see persistTickets' doc comment).
 * Exported for unit testing.
 */
export async function computeAndPersistScores(): Promise<number> {
  const weights = await getOrCreateWeightConfig();
  const period = currentMonthPeriod();

  const people = await prisma.person.findMany({
    include: { identities: { include: { commits: true, tickets: true } } },
  });

  let scoredCount = 0;
  for (const person of people) {
    const commits = person.identities.flatMap((identity) => identity.commits);
    const tickets = person.identities.flatMap((identity) => identity.tickets);
    if (commits.length === 0 && tickets.length === 0) continue;

    const metrics = computeAxisMetrics(commits, tickets, period);
    const finalScore = calculateScore(metrics, weights);
    const grade = assignGrade(finalScore);

    await prisma.scoreResult.upsert({
      where: {
        personId_periodStart_periodEnd: {
          personId: person.id,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
      update: { ...metrics, finalScore, grade },
      create: { personId: person.id, periodStart: period.start, periodEnd: period.end, ...metrics, finalScore, grade },
    });
    scoredCount += 1;
  }

  return scoredCount;
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

    const [authors, commits, tickets, contributorStats] = await Promise.all([
      connector.fetchAuthors(),
      connector.fetchCommits(new Date(0)), // full history — see docs/ARCHITECTURE.md decision log
      issuesConnector.fetchTickets(new Date(0)), // full history, same rationale
      connector.fetchContributorStats(), // S-04 — see applyOutlierFlags
    ]);

    const { identityCount, commitCount } = await persist(project.id, authors, commits);
    const ticketCount = await persistTickets(project.id, tickets);

    let flaggedCommitCount = 0;
    if (contributorStats.status === "ready") {
      const outlierWeeks = detectOutlierWeeks(contributorStats.stats);
      flaggedCommitCount = await applyOutlierFlags(project.id, outlierWeeks);
    } else {
      console.log(
        `[worker] contributor stats not ready yet for ${owner}/${repo} (GitHub still computing) — ` +
          `will retry next sync tick`
      );
    }

    const scoredCount = await computeAndPersistScores();

    console.log(
      `[worker] synced ${owner}/${repo}: ${identityCount} identities, ${commitCount} commits, ` +
        `${ticketCount} tickets persisted, ${flaggedCommitCount} commits flagged as LOC outliers, ` +
        `${scoredCount} people scored for the current period`
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

// Guard so importing this module for tests (e.g. to unit-test
// applyOutlierFlags) doesn't also kick off main()'s setInterval loop.
const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  main().catch((err) => {
    console.error("[worker] fatal error", err);
    process.exit(1);
  });
}

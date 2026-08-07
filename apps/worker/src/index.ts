/**
 * Sync worker entrypoint. Fetches commits/authors/tickets via
 * packages/connectors and persists them via packages/db, across
 * every project configured in SYNC_PROJECTS (see parseProjectConfigs
 * and .env.example) — GitHub/GitLab/Jira/Linear, any mix, any count.
 *
 * Persistence model per configured project, per sync tick:
 *   1. Upsert the Project row for this connector+externalRef.
 *   2. If the connector has a source (commits/authors — GitHub,
 *      GitLab): upsert an Identity row per distinct author
 *      (unresolved by default — see docs/ARCHITECTURE.md §3 / screen
 *      S-07. Nothing here auto-links an Identity to a Person; that's
 *      a human decision made in the S-07 UI), then upsert a Commit
 *      row per commit, linked to its Identity.
 *   3. If the connector has a tracker (tickets — GitHub, Jira,
 *      Linear): upsert a Ticket row per ticket.
 *   4. GitHub only: S-04 — fetch weekly per-author contributor
 *      stats, run them through packages/metrics#detectOutlierWeeks,
 *      and flag every Commit in a flagged author-week as excluded
 *      (see that package's docstring for why the grain is
 *      "author-week", not "single commit"). GitLab's connector
 *      already gets per-commit stats for free (see its doc comment)
 *      but nothing here aggregates them into weekly stats yet —
 *      deferred, not forgotten.
 *   5. Once every configured project has synced (each project's
 *      failure is caught and logged independently — one bad project
 *      doesn't block the rest): S-02 recomputes a ScoreResult for
 *      every Person with any tracked activity, for EVERY calendar
 *      month from the earliest commit/ticket activity in the whole
 *      DB through the current month (computeAndPersistScoresForAllPeriods)
 *      — not just the current month, so history that predates this
 *      worker ever running (e.g. commits synced from an existing repo)
 *      still gets a ScoreResult and shows up in the web app's period
 *      picker. Idempotent upsert per period, so re-running mid-month
 *      just refreshes the same snapshots (see ScoreResult's schema
 *      comment).
 */
import {
  GitHubConnector,
  GitHubIssuesConnector,
  GitLabConnector,
  GitLabIssuesConnector,
  JiraConnector,
  LinearConnector,
} from "@rateyourcommit/connectors";
import type { RawCommit, RawIdentity, RawTicket } from "@rateyourcommit/connectors";
import {
  computeAxisMetrics,
  computeRawActivity,
  currentMonthPeriod,
  detectOutlierWeeks,
  listMonthsInRange,
} from "@rateyourcommit/metrics";
import type { OutlierWeek, PeriodRange } from "@rateyourcommit/metrics";
import { assignGrade, calculateScore } from "@rateyourcommit/scoring";
import type { AxisWeights } from "@rateyourcommit/scoring";
import { DEFAULT_ORGANIZATION_ID, prisma } from "@rateyourcommit/db";
import type { ProjectConfig } from "./parseProjectConfigs";
import { parseProjectConfigs } from "./parseProjectConfigs";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function identityKey(identity: Pick<RawIdentity, "handle" | "email">): string {
  return `${identity.handle}::${identity.email ?? ""}`;
}

/**
 * Finds (or creates) the Identity for (handle, email). NOT a plain
 * `prisma.identity.upsert()` on the handle_email compound key when
 * email is absent: Prisma's generated input for a nullable member of
 * a compound-unique key requires a non-null string there, and —
 * confirmed empirically against a live Postgres — actually throws
 * `PrismaClientValidationError` at runtime for `email: null`. This
 * was silently broken since the ticket-assignee-identity feature was
 * added: every worker test mocks Prisma entirely, so nothing ever
 * exercised the real client, and no real deployment has synced
 * tickets yet either. It's not just a missing type annotation —
 * `resolveAssigneeIdentityId` below hits this on every ticket that
 * has an assignee, across every tracker connector (GitHub issues,
 * Jira, Linear, GitLab issues).
 *
 * Postgres itself doesn't error on the underlying `WHERE handle = ?
 * AND email IS NULL` this falls back to — a unique index doesn't
 * dedupe NULLs (each NULL is distinct under SQL's unique-constraint
 * semantics, confirmed empirically too) — so this can't rely on a
 * database-level upsert for the null-email case either. findFirst
 * reliably reuses an existing row across sequential sync ticks (this
 * worker's actual usage pattern — a single `setInterval` loop, not
 * concurrent callers), which is the property that matters here.
 */
async function findOrCreateIdentity(
  handle: string,
  email: string | undefined
): Promise<{ id: string }> {
  if (email) {
    return prisma.identity.upsert({
      where: { handle_email: { handle, email } },
      update: {},
      create: { handle, email },
    });
  }

  const existing = await prisma.identity.findFirst({ where: { handle, email: null } });
  if (existing) return existing;
  return prisma.identity.create({ data: { handle } });
}

export async function persist(
  projectId: string,
  authors: RawIdentity[],
  commits: RawCommit[]
): Promise<{ identityCount: number; commitCount: number }> {
  const identityIdByKey = new Map<string, string>();

  for (const author of authors) {
    const identity = await findOrCreateIdentity(author.handle, author.email);
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
  const identity = await findOrCreateIdentity(handle, undefined);
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
 * Recomputes and upserts `period`'s ScoreResult for every Person with
 * any tracked activity (skips people with zero commits/tickets ever —
 * nothing to score yet, not "scored 100/S by default"). Aggregates
 * across ALL of a person's linked Identities, since one person can
 * have more than one (see persistTickets' doc comment). Takes the
 * period explicitly rather than defaulting to "now" — see
 * computeAndPersistScoresForAllPeriods below, which decides which
 * periods actually need computing and calls this once per period.
 * Exported for unit testing.
 */
export async function computeAndPersistScores(period: PeriodRange): Promise<number> {
  const weights = await getOrCreateWeightConfig();

  const people = await prisma.person.findMany({
    include: { identities: { include: { commits: true, tickets: true } } },
  });

  let scoredCount = 0;
  for (const person of people) {
    const commits = person.identities.flatMap((identity) => identity.commits);
    const tickets = person.identities.flatMap((identity) => identity.tickets);
    if (commits.length === 0 && tickets.length === 0) continue;

    // Prisma returns a nullable DateTime column as `null`, but
    // TicketForMetrics (packages/metrics — deliberately store-agnostic,
    // see its own doc comment) uses `undefined` for "not closed",
    // matching RawTicket's convention everywhere else. Passing raw
    // Prisma rows through unmapped silently miscounts every currently-
    // open ticket as inactive (`closedAt === undefined` is false for
    // `null`, and `null >= period.start` is also false) — confirmed via
    // tsc catching the type mismatch, not just a type nicety.
    const ticketsForMetrics = tickets.map((ticket) => ({
      ...ticket,
      closedAt: ticket.closedAt ?? undefined,
    }));

    const metrics = computeAxisMetrics(commits, ticketsForMetrics, period);
    const finalScore = calculateScore(metrics, weights);
    const grade = assignGrade(finalScore);
    // Reference-only counts (see ScoreResult's schema doc comment) —
    // never fed into finalScore, just the same period-filtered
    // commit/ticket sets computeAxisMetrics already used, exposed as
    // plain counts for /scorecard's "커밋 수"/"티켓 수" columns.
    const rawActivity = computeRawActivity(commits, ticketsForMetrics, period);

    await prisma.scoreResult.upsert({
      where: {
        personId_periodStart_periodEnd: {
          personId: person.id,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
      update: { ...metrics, finalScore, grade, ...rawActivity },
      create: {
        personId: person.id,
        periodStart: period.start,
        periodEnd: period.end,
        ...metrics,
        finalScore,
        grade,
        ...rawActivity,
      },
    });
    scoredCount += 1;
  }

  return scoredCount;
}

/**
 * Decides WHICH periods need a ScoreResult and computes all of them —
 * every calendar month from the earliest commit/ticket activity ever
 * synced through the current month, not just "now". Without this,
 * activity that predates this worker's own uptime (e.g. a repo's full
 * commit history synced on day one, like GitHubConnector.fetchCommits'
 * `new Date(0)` full-history fetch already does) could never get a
 * ScoreResult at all: computeAndPersistScores only ever computed
 * "this month" every tick, so a person whose only activity was in the
 * past would silently never show up in the web app's period picker
 * (apps/web/lib/available-periods.ts only lists periods that already
 * have a ScoreResult row).
 *
 * Re-derives the full backfill range from scratch every sync tick
 * (idempotent upserts make re-running any period cheap and safe) —
 * simpler than persisting "already backfilled" state, and correct as
 * long as this project's history stays small enough that re-scanning
 * it every 15 minutes isn't a real cost. Revisit if that stops being
 * true.
 *
 * Skips any period with a ScoreConfirmation row (S-06's "확정" step —
 * see that model's schema doc comment): once a period's compensation
 * grades are confirmed, they're a frozen snapshot, not something a
 * later sync tick should silently recompute out from under an admin
 * who already signed off on it.
 */
export async function computeAndPersistScoresForAllPeriods(): Promise<number> {
  const [earliestCommit, earliestTicket, confirmedPeriods] = await Promise.all([
    prisma.commit.aggregate({ _min: { authoredAt: true } }),
    prisma.ticket.aggregate({ _min: { createdAt: true } }),
    prisma.scoreConfirmation.findMany({ select: { periodStart: true } }),
  ]);

  const candidates = [earliestCommit._min.authoredAt, earliestTicket._min.createdAt].filter(
    (date): date is Date => date instanceof Date
  );

  // No activity synced anywhere yet — same as today's behavior,
  // compute just the current month rather than an empty backfill.
  const earliest =
    candidates.length > 0
      ? new Date(Math.min(...candidates.map((date) => date.getTime())))
      : currentMonthPeriod().start;

  const confirmedStarts = new Set(confirmedPeriods.map((row) => row.periodStart.getTime()));
  const periods = listMonthsInRange(earliest, new Date()).filter(
    (period) => !confirmedStarts.has(period.start.getTime())
  );

  let totalScored = 0;
  for (const period of periods) {
    totalScored += await computeAndPersistScores(period);
  }
  return totalScored;
}

/** Project.externalRef for a given config — paired with `connector`,
 * uniquely identifies the Project row (see the connectorId_externalRef
 * unique constraint in packages/db's schema). */
function externalRefFor(config: ProjectConfig): string {
  switch (config.connector) {
    case "github":
      return `${config.owner}/${config.repo}`;
    case "gitlab":
      return config.projectPath;
    case "jira":
      return config.projectKey;
    case "linear":
      return config.teamKey;
  }
}

/**
 * Syncs one configured project end to end (see the module doc comment
 * for the full per-project persistence model). Exported for unit
 * testing of externalRefFor's branches via the connector-selection
 * logic below, without needing a live Prisma/network stack.
 */
async function syncProject(config: ProjectConfig): Promise<void> {
  const externalRef = externalRefFor(config);
  const project = await prisma.project.upsert({
    where: { connectorId_externalRef: { connectorId: config.connector, externalRef } },
    update: {},
    create: { name: externalRef, connectorId: config.connector, externalRef },
  });

  console.log(`[worker] syncing ${config.connector}:${externalRef}...`);

  let identityCount = 0;
  let commitCount = 0;
  let ticketCount = 0;
  let flaggedCommitCount = 0;

  switch (config.connector) {
    case "github": {
      const source = new GitHubConnector({
        owner: config.owner,
        repo: config.repo,
        token: process.env.GITHUB_TOKEN,
      });
      const tracker = new GitHubIssuesConnector({
        owner: config.owner,
        repo: config.repo,
        token: process.env.GITHUB_TOKEN,
      });
      const [authors, commits, tickets, contributorStats] = await Promise.all([
        source.fetchAuthors(),
        source.fetchCommits(new Date(0)), // full history — see docs/ARCHITECTURE.md decision log
        tracker.fetchTickets(new Date(0)), // full history, same rationale
        source.fetchContributorStats(), // S-04 — see applyOutlierFlags
      ]);

      ({ identityCount, commitCount } = await persist(project.id, authors, commits));
      ticketCount = await persistTickets(project.id, tickets);

      if (contributorStats.status === "ready") {
        flaggedCommitCount = await applyOutlierFlags(
          project.id,
          detectOutlierWeeks(contributorStats.stats)
        );
      } else {
        console.log(
          `[worker] contributor stats not ready yet for ${externalRef} (GitHub still computing) — ` +
            `will retry next sync tick`
        );
      }
      break;
    }
    case "gitlab": {
      const source = new GitLabConnector({
        projectPath: config.projectPath,
        baseUrl: config.baseUrl,
        token: process.env.GITLAB_TOKEN,
      });
      const tracker = new GitLabIssuesConnector({
        projectPath: config.projectPath,
        baseUrl: config.baseUrl,
        token: process.env.GITLAB_TOKEN,
      });
      const [authors, commits, tickets] = await Promise.all([
        source.fetchAuthors(),
        source.fetchCommits(new Date(0)),
        tracker.fetchTickets(new Date(0)),
      ]);
      ({ identityCount, commitCount } = await persist(project.id, authors, commits));
      ticketCount = await persistTickets(project.id, tickets);
      // No outlier detection (S-04) for GitLab yet — see the module
      // doc comment: GitLabConnector's per-commit stats aren't
      // aggregated into weekly outlier input anywhere yet.
      break;
    }
    case "jira": {
      const tracker = new JiraConnector({
        baseUrl: config.baseUrl,
        projectKey: config.projectKey,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN,
      });
      ticketCount = await persistTickets(project.id, await tracker.fetchTickets(new Date(0)));
      break;
    }
    case "linear": {
      const tracker = new LinearConnector({
        teamKey: config.teamKey,
        apiKey: process.env.LINEAR_API_KEY,
      });
      ticketCount = await persistTickets(project.id, await tracker.fetchTickets(new Date(0)));
      break;
    }
  }

  console.log(
    `[worker] synced ${externalRef}: ${identityCount} identities, ${commitCount} commits, ` +
      `${ticketCount} tickets persisted, ${flaggedCommitCount} commits flagged as LOC outliers`
  );
}

async function runSync(): Promise<void> {
  let configs: ProjectConfig[];
  try {
    configs = parseProjectConfigs(process.env.SYNC_PROJECTS);
  } catch (err) {
    console.error("[worker] invalid SYNC_PROJECTS, skipping this sync tick:", err);
    return;
  }

  if (configs.length === 0) {
    console.log(
      `[worker] sync tick at ${new Date().toISOString()} — SYNC_PROJECTS not set, skipping`
    );
    return;
  }

  for (const config of configs) {
    try {
      await syncProject(config);
    } catch (err) {
      // One project's failure shouldn't block the rest — a real
      // behavior change from the old single-project worker, where an
      // uncaught error just aborted the whole tick silently.
      console.error(`[worker] sync failed for ${config.connector}:${externalRefFor(config)}:`, err);
    }
  }

  const scoredCount = await computeAndPersistScoresForAllPeriods();
  console.log(`[worker] ${scoredCount} person-periods scored (backfilling all history)`);
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

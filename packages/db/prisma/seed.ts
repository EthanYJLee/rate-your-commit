/**
 * Dev-only seed data. Mirrors the kind of messy identities the S-07
 * screen exists to untangle — deliberately not lorem ipsum. Safe to
 * re-run (idempotent upserts).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.upsert({
    where: { connectorId_externalRef: { connectorId: "github", externalRef: "acme/widgets-api" } },
    update: {},
    create: { name: "acme/widgets-api", connectorId: "github", externalRef: "acme/widgets-api", difficultyFactor: 1.0 },
  });

  const identities = [
    { handle: "jane-dev", email: "jane@acme.com", status: "pending" as const },
    { handle: "jsmith88", email: "jane@acme.com", status: "pending" as const }, // same email, different handle — S-07 candidate
    { handle: "bwilson", email: "bob@acme.com", status: "confirmed" as const },
    { handle: "ci-bot", email: "ci@shared-runner.internal", status: "shared_account" as const },
  ];

  for (const [i, identity] of identities.entries()) {
    const row = await prisma.identity.upsert({
      where: { handle_email: { handle: identity.handle, email: identity.email } },
      update: { status: identity.status },
      create: identity,
    });

    await prisma.commit.upsert({
      where: { projectId_sha: { projectId: project.id, sha: `seed-sha-${i}` } },
      update: {},
      create: {
        sha: `seed-sha-${i}`,
        message: i === 0 ? "Fix pagination bug in widgets list" : `seed commit ${i}`,
        additions: 12 + i * 4,
        deletions: 3 + i,
        authoredAt: new Date(Date.now() - i * 86_400_000),
        identityId: row.id,
        projectId: project.id,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

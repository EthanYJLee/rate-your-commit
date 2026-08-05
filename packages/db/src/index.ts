import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In dev, Next.js hot-reload would otherwise
 * spawn a new client (and a new DB connection) on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Single-tenant MVP: there's no multi-org auth yet (self-hosted,
 * small-team target — docs/ARCHITECTURE.md §1), so every
 * ScoreWeightConfig belongs to this one fixed organization until
 * multi-org support exists. Shared here so apps/worker (writes) and
 * apps/web (reads/writes via the settings screen) can't drift.
 */
export const DEFAULT_ORGANIZATION_ID = "default";

export * from "@prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single shared Prisma Client instance for the whole app.
 *
 * Prisma 7 requires an explicit driver adapter instead of reading a
 * connection string straight from the datasource block (the classic
 * `datasourceUrl`/`datasources` options no longer exist on PrismaClient).
 * @prisma/adapter-pg wraps `pg.Pool`, which — like the adapter itself —
 * is lazy: constructing it here does not open a database connection.
 * Prisma only connects when a query is actually executed. DATABASE_URL
 * is intentionally still unset in this environment, and nothing in this
 * file runs a query, so no connection attempt happens on import.
 *
 * This is the ONLY module allowed to instantiate PrismaClient — per
 * docs/07-database-architecture.md and docs/architecture/folder-structure.md,
 * every other module (app/, components/, features/, and even domain
 * services) must go through the functions exported from src/services,
 * never import this file directly.
 *
 * Cached on `globalThis` outside production so Next.js's dev-mode module
 * reloading doesn't create a new client (and a new connection pool) on
 * every file change.
 */
declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");

export const prisma = globalThis.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

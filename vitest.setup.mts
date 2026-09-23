// Loads .env into process.env for the Vitest process (a separate Node
// process from Next.js, which does not share Next's own env loading).
// "dotenv" is already present in node_modules as an existing dependency
// of Prisma's own tooling (see prisma7.config.ts) — no new package was
// installed for this.
import "dotenv/config";

import { afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * setupFiles content runs inside each test file's own isolated module
 * context (Vitest's default isolate: true — see vitest.config.mts),
 * which is exactly why this works: this top-level afterAll registers
 * against THAT file's own root describe, so it fires once that file's
 * tests finish, closing THAT file's own @/lib/prisma singleton (and its
 * underlying pg.Pool) before Vitest resets the module registry for the
 * next file.
 *
 * Root cause this addresses: no test file, nor this project's Vitest
 * config, ever called prisma.$disconnect() anywhere. Combined with
 * fileParallelism: false (which forces a single, long-lived forked
 * worker process for the whole run — see vitest.config.mts), every one
 * of this suite's real-database test files was leaving its own
 * never-closed connection pool behind in that same process, all of them
 * accumulating for the rest of the run and competing for Neon's
 * serverless pooler. This never touches src/lib/prisma.ts or any
 * production code path — it only ever runs inside the Vitest process.
 *
 * A file that never touched the database still safely no-ops here:
 * @/lib/prisma's pg.Pool is lazy (see src/lib/prisma.ts's own comment),
 * so disconnecting an idle, never-connected pool is a harmless no-op.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * First test configuration in this project — docs/12-testing-strategy.md
 * explicitly deferred the test-runner choice "until the first tests are
 * actually written" (this task). Vitest was chosen because it needs no
 * extra bundler/Babel config for TypeScript/ESM (this project's native
 * format), and every test here exercises pure service-layer logic — no
 * React rendering is required, so no jsdom/browser environment is
 * configured.
 */
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.mts"],
    include: ["src/**/*.test.ts"],
    // These tests hit the real development Neon database; its serverless
    // connection pooler can have multi-second cold-start latency on the
    // first query of a run, well beyond Vitest's 5s default.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Vitest's default is to run test FILES in parallel across several
    // workers. With enough real-Neon-database test files now (Version
    // 1.1's candidate-dashboard suite added several more), running them
    // all at once caused genuine connection-pool contention — multiple
    // files' beforeAll fixture setup competing for Neon's serverless
    // pooler at the same moment, timing out well before any single
    // file's own (already-generous) 20s hook budget. Running files
    // sequentially trades some wall-clock time for eliminating that
    // contention outright; each file's own tests still run at normal
    // speed once it has the database to itself.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});

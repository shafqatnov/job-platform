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
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});

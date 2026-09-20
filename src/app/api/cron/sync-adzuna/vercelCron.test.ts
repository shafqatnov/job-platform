import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Verifies the Vercel Cron wiring for the Adzuna sync route
 * (vercel.json, at the repo root — not itself a TypeScript module, so
 * this reads and parses it as plain JSON rather than importing it).
 * Deliberately narrow: this only checks the cron CONFIGURATION is
 * correct and secret-free. The route's own authorization behavior is
 * covered by route.test.ts; syncAdzunaJobs's own authorization/
 * enablement gate is covered by syncAdzunaJobs.test.ts — neither is
 * duplicated here.
 */
const VERCEL_CONFIG_PATH = path.join(process.cwd(), "vercel.json");
const RAW_CONFIG = fs.readFileSync(VERCEL_CONFIG_PATH, "utf8");
const CONFIG = JSON.parse(RAW_CONFIG) as { crons?: Array<{ path: string; schedule: string }> };

describe("vercel.json: Adzuna sync cron configuration", () => {
  it("1. contains a cron entry pointing exactly to /api/cron/sync-adzuna", () => {
    const entry = CONFIG.crons?.find((c) => c.path === "/api/cron/sync-adzuna");
    expect(entry).toBeDefined();
  });

  it("2. the schedule is exactly once every 6 hours (0 */6 * * *)", () => {
    const entry = CONFIG.crons?.find((c) => c.path === "/api/cron/sync-adzuna");
    expect(entry?.schedule).toBe("0 */6 * * *");
  });

  it("3. exactly one cron entry exists — no other cron jobs were added", () => {
    expect(CONFIG.crons).toHaveLength(1);
  });

  it("4. no secret or credential-shaped value appears anywhere in vercel.json", () => {
    expect(RAW_CONFIG).not.toMatch(/ADZUNA_SYNC_TRIGGER_SECRET\s*[:=]\s*["'][^"']+["']/);
    expect(RAW_CONFIG).not.toMatch(/authorization/i);
    expect(RAW_CONFIG).not.toMatch(/bearer/i);
    // Only the two documented fields (plus the optional $schema key) —
    // no headers/env objects of any kind.
    const entry = CONFIG.crons?.[0];
    expect(Object.keys(entry ?? {}).sort()).toEqual(["path", "schedule"]);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Verifies the GitHub Actions workflow that replaces Vercel Cron as the
 * scheduler for the existing, already-protected /api/cron/sync-adzuna
 * endpoint (Vercel's Hobby plan only permits once-daily cron schedules,
 * too infrequent for the required 6-hour cadence). Deliberately
 * structural/text-based rather than a full YAML parse — this repo has
 * no YAML-parsing package as a direct dependency, and adding one just
 * for this test would be more than the smallest required change.
 *
 * The route's own authorization behavior is covered by route.test.ts;
 * syncAdzunaJobs's own authorization/enablement gate is covered by
 * syncAdzunaJobs.test.ts — neither is duplicated here.
 */
const REPO_ROOT = path.join(process.cwd());
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github", "workflows", "sync-adzuna.yml");
const WORKFLOW = fs.readFileSync(WORKFLOW_PATH, "utf8");

describe(".github/workflows/sync-adzuna.yml", () => {
  it("1. the workflow file exists and is readable", () => {
    expect(WORKFLOW.length).toBeGreaterThan(0);
  });

  it("2. the schedule is exactly once every 6 hours (0 */6 * * *)", () => {
    expect(WORKFLOW).toMatch(/cron:\s*["']0 \*\/6 \* \* \*["']/);
  });

  it("does not run on push, and adds no other schedule", () => {
    expect(WORKFLOW).not.toMatch(/^\s*push:/m);
    const cronMatches = WORKFLOW.match(/-\s*cron:/g) ?? [];
    expect(cronMatches).toHaveLength(1);
  });

  it("3. workflow_dispatch is present, so it can be triggered manually", () => {
    expect(WORKFLOW).toMatch(/workflow_dispatch:/);
  });

  it("4. the endpoint is exactly https://www.jobnura.com/api/cron/sync-adzuna", () => {
    expect(WORKFLOW).toContain("https://www.jobnura.com/api/cron/sync-adzuna");
  });

  it("5. the workflow references secrets.ADZUNA_SYNC_TRIGGER_SECRET", () => {
    expect(WORKFLOW).toMatch(/secrets\.ADZUNA_SYNC_TRIGGER_SECRET/);
  });

  it("6. no Adzuna/OpenAI credential is referenced in the workflow", () => {
    expect(WORKFLOW).not.toContain("ADZUNA_APP_ID");
    expect(WORKFLOW).not.toContain("ADZUNA_APP_KEY");
    expect(WORKFLOW).not.toContain("OPENAI_API_KEY");
  });

  it("7. no secret value is hardcoded — the trigger secret only ever flows through secrets./env, never a literal", () => {
    // The only place a secret-shaped identifier appears is the
    // GitHub-managed secrets. reference and its own env passthrough —
    // never assigned a literal string value.
    expect(WORKFLOW).not.toMatch(/ADZUNA_SYNC_TRIGGER_SECRET\s*[:=]\s*["'][^"'$][^"']*["']/);
    // The workflow never echoes the Authorization header or the secret itself.
    expect(WORKFLOW).not.toMatch(/echo.*Authorization/i);
    expect(WORKFLOW).not.toMatch(/echo.*ADZUNA_SYNC_TRIGGER_SECRET/i);
  });

  it("uses a bounded curl call and fails the job on a non-2xx response", () => {
    expect(WORKFLOW).toMatch(/curl/);
    expect(WORKFLOW).toMatch(/--max-time/);
    expect(WORKFLOW).toMatch(/exit 1/);
  });

  it("has concurrency protection so overlapping runs cannot happen", () => {
    expect(WORKFLOW).toMatch(/concurrency:/);
    expect(WORKFLOW).toMatch(/cancel-in-progress:\s*true/);
  });

  it("9+10. no Vercel cron config remains, and this is the only Adzuna scheduler", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "vercel.json"))).toBe(false);
    const workflowFiles = fs.readdirSync(path.join(REPO_ROOT, ".github", "workflows"));
    const adzunaWorkflows = workflowFiles.filter((f) => f.toLowerCase().includes("adzuna"));
    expect(adzunaWorkflows).toEqual(["sync-adzuna.yml"]);
  });
});

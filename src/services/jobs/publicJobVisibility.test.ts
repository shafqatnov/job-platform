import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import { prisma } from "@/lib/prisma";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

const SOURCE = readFileSync(new URL("./publicJobVisibility.ts", import.meta.url), "utf8");

describe("publicJobVisibilityWhere", () => {
  it("never imports OpenAI or any Greenhouse pipeline module — purely a Prisma where-fragment", () => {
    expect(SOURCE).not.toMatch(/from ["']openai["']/i);
    expect(SOURCE).not.toMatch(/greenhouse/i);
  });

  it("excludes only exact bracketed fixture-marker prefixes, never a bare 'test'/'qa' keyword", () => {
    // "Test Inspector" contains neither confirmed marker as a PREFIX —
    // this is a structural sanity check on the marker list itself, not
    // a query test (see getPublicJobs.test.ts for the real DB behavior).
    expect(SOURCE).toContain('"[IMPORT TEST]"');
    expect(SOURCE).toContain('"[LOCATION REVIEW TEST]"');
    expect(SOURCE).not.toMatch(/title:\s*{\s*contains:\s*["']test["']/i);
  });

  it("real dev database: excludes an [IMPORT TEST] job and keeps a legitimate 'Test Inspector' job, via the shared function directly", async () => {
    const fixtures = await createModerationTestFixtures();
    try {
      const fixtureJob = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      const legitimateJob = await createTestJob(fixtures, { title: "Test Inspector", status: "active" });

      const visibleIds = (
        await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
      ).map((j) => j.id);

      expect(visibleIds).not.toContain(fixtureJob.id);
      expect(visibleIds).toContain(legitimateJob.id);
    } finally {
      await cleanupModerationTestFixtures(fixtures);
    }
  });
});

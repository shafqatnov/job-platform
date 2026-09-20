import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicJobsForSitemap } from "@/services/jobs/getPublicJobsForSitemap";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/**
 * Confirms getPublicJobsForSitemap.ts is actually wired to the same
 * centralized publicJobVisibilityWhere() rule as getPublicJobs.ts (see
 * publicJobVisibility.ts) — so a search engine can never index a
 * leftover test-fixture job either.
 */
describe("getPublicJobsForSitemap test-fixture exclusion (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  function slugsOf(entries: Awaited<ReturnType<typeof getPublicJobsForSitemap>>): string[] {
    return entries.map((entry) => entry.slug);
  }

  it("an [IMPORT TEST] job never appears in the sitemap", async () => {
    const job = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
    const jobRow = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true } });
    try {
      const result = await getPublicJobsForSitemap();
      expect(slugsOf(result)).not.toContain(jobRow.slug);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("a legitimate 'QA Test Engineer' job appears in the sitemap", async () => {
    const job = await createTestJob(fixtures, { title: "QA Test Engineer", status: "active" });
    const jobRow = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true } });
    try {
      const result = await getPublicJobsForSitemap();
      expect(slugsOf(result)).toContain(jobRow.slug);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });
});

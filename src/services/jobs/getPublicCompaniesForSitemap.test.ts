import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicCompaniesForSitemap } from "@/services/jobs/getPublicCompaniesForSitemap";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/**
 * Confirms getPublicCompaniesForSitemap.ts is wired to the same
 * centralized publicJobVisibilityWhere() rule as getPublicJobs.ts and
 * getPublicCompanyBySlug.ts — a company with only a test-fixture-marked
 * job (or zero active jobs at all) never appears in the sitemap either.
 */
describe("getPublicCompaniesForSitemap (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let companySlug: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const company = await prisma.company.findUniqueOrThrow({ where: { id: fixtures.companyId }, select: { slug: true } });
    companySlug = company.slug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  function slugsOf(entries: Awaited<ReturnType<typeof getPublicCompaniesForSitemap>>): string[] {
    return entries.map((entry) => entry.slug);
  }

  it("a company with a genuine active job appears in the sitemap", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Sitemap Fixture Job", status: "active" });
    try {
      const result = await getPublicCompaniesForSitemap();
      expect(slugsOf(result)).toContain(companySlug);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("a company whose only job is an [IMPORT TEST] fixture never appears in the sitemap", async () => {
    const job = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
    try {
      const result = await getPublicCompaniesForSitemap();
      expect(slugsOf(result)).not.toContain(companySlug);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });
});

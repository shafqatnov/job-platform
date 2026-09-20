import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicJobBySlug } from "@/services/jobs/getPublicJobBySlug";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/**
 * Confirms getPublicJobBySlug.ts is actually wired to the same
 * centralized publicJobVisibilityWhere() rule as getPublicJobs.ts (see
 * publicJobVisibility.ts) — not just that the rule itself works.
 */
describe("getPublicJobBySlug test-fixture exclusion (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let countryUrlSlug: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const country = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } });
    countryUrlSlug = country.urlSlug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  async function createSluggedJob(title: string, status: "active" | "rejected" = "active") {
    const slug = `public-job-by-slug-test-${crypto.randomUUID()}`;
    const job = await prisma.job.create({
      data: {
        companyId: fixtures.companyId,
        countryId: fixtures.countryId,
        cityId: fixtures.cityId,
        categoryId: fixtures.categoryId,
        postedByUserId: fixtures.userId,
        title,
        description: "A temporary automated-test job for the public job-detail page test.",
        slug,
        status,
        applicationMethod: "on_platform",
      },
      select: { id: true, slug: true },
    });
    return job;
  }

  it("an [IMPORT TEST] job is not reachable by its own slug", async () => {
    const job = await createSluggedJob("[IMPORT TEST] Backend Engineer");
    try {
      const result = await getPublicJobBySlug({ countryUrlSlug, jobSlug: job.slug });
      expect(result).toBeNull();
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("a legitimate 'Test Inspector' job remains reachable by its own slug", async () => {
    const job = await createSluggedJob("Test Inspector");
    try {
      const result = await getPublicJobBySlug({ countryUrlSlug, jobSlug: job.slug });
      expect(result?.title).toBe("Test Inspector");
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("uses createTestJob/moderation fixtures' own [AI MODERATION TEST] job normally (unaffected by this change)", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Detail Page Job", status: "active" });
    const jobRow = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true } });
    const result = await getPublicJobBySlug({ countryUrlSlug, jobSlug: jobRow.slug });
    expect(result?.id).toBe(job.id);
  });
});

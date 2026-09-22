import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicCategoryBySlug, getOtherPopulatedCategories } from "@/services/jobs/getPublicCategoryBySlug";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

describe("getPublicCategoryBySlug (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let categoryName: string;
  let categorySlug: string;
  let countryName: string;
  let countryUrlSlug: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [category, country] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { name: true, slug: true } }),
      prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { name: true, urlSlug: true } }),
    ]);
    categoryName = category.name;
    categorySlug = category.slug;
    countryName = country.name;
    countryUrlSlug = country.urlSlug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("an unknown slug returns null (drives the route's genuine 404)", async () => {
    const result = await getPublicCategoryBySlug("definitely-not-a-real-category-slug");
    expect(result).toBeNull();
  });

  it("5. a real category with zero currently-public jobs still resolves (non-null), with openJobCount 0 and empty aggregates — unlike a company, a category stays a real reachable page when empty", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      const category = await prisma.category.findUniqueOrThrow({ where: { id: isolatedFixtures.categoryId }, select: { slug: true } });
      const result = await getPublicCategoryBySlug(category.slug);
      expect(result).not.toBeNull();
      expect(result?.openJobCount).toBe(0);
      expect(result?.hiringCountries).toEqual([]);
      expect(result?.hiringCompanies).toEqual([]);
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  it("4. a category with only a test-fixture-marked job still shows openJobCount 0 (the shared visibility rule applies here too)", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      await createTestJob(isolatedFixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      const category = await prisma.category.findUniqueOrThrow({ where: { id: isolatedFixtures.categoryId }, select: { slug: true } });
      const result = await getPublicCategoryBySlug(category.slug);
      expect(result?.openJobCount).toBe(0);
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  it("4. an expired job does not count as a public job in this category", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      await createTestJob(isolatedFixtures, {
        title: "[AI MODERATION TEST] Expired Category Fixture Job",
        status: "active",
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      });
      const category = await prisma.category.findUniqueOrThrow({ where: { id: isolatedFixtures.categoryId }, select: { slug: true } });
      const result = await getPublicCategoryBySlug(category.slug);
      expect(result?.openJobCount).toBe(0);
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  it("3. a category with a genuine active job resolves with correct name/openJobCount/hiring aggregates", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Category Landing Fixture Job", status: "active" });
    try {
      const result = await getPublicCategoryBySlug(categorySlug);
      expect(result).not.toBeNull();
      expect(result?.name).toBe(categoryName);
      expect(result?.openJobCount).toBeGreaterThanOrEqual(1);
      expect(result?.hiringCountries.some((c) => c.slug === countryUrlSlug && c.name === countryName)).toBe(true);
      const company = await prisma.company.findUniqueOrThrow({ where: { id: fixtures.companyId }, select: { slug: true, name: true } });
      expect(result?.hiringCompanies.some((c) => c.slug === company.slug && c.name === company.name)).toBe(true);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("6. a category's own openJobCount automatically increases/decreases as its jobs are created/removed (no stale caching across separate calls)", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      const category = await prisma.category.findUniqueOrThrow({ where: { id: isolatedFixtures.categoryId }, select: { slug: true } });

      const before = await getPublicCategoryBySlug(category.slug);
      expect(before?.openJobCount).toBe(0);

      const job = await createTestJob(isolatedFixtures, { title: "[AI MODERATION TEST] Newly Populated Category Job", status: "active" });
      const during = await getPublicCategoryBySlug(category.slug);
      expect(during?.openJobCount).toBe(1);

      await prisma.job.delete({ where: { id: job.id } });
      const after = await getPublicCategoryBySlug(category.slug);
      expect(after?.openJobCount).toBe(0);
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  describe("getOtherPopulatedCategories", () => {
    it("never includes the category it was asked to exclude", async () => {
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Self Exclusion Check", status: "active" });
      try {
        const result = await getOtherPopulatedCategories(fixtures.categoryId);
        expect(result.some((c) => c.slug === categorySlug)).toBe(false);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("includes another category that currently has a genuine public job", async () => {
      // Picks a category that is CURRENTLY genuinely empty (dynamically,
      // never assuming which real slug that is) so this test's own job
      // is what makes it newly populated — not one of the real
      // categories already populated in this shared dev database, which
      // getOtherPopulatedCategories's own RELATED_CATEGORIES_LIMIT cap
      // could otherwise already be full of. If every category already
      // has a public job, this scenario can't be forced; skip gracefully
      // rather than failing on live data shape (same convention as
      // getPublicJobs.test.ts's own Adzuna-attribution test).
      const categories = await prisma.category.findMany({ where: { id: { not: fixtures.categoryId } }, select: { id: true, slug: true } });
      let emptyCategory: { id: string; slug: string } | undefined;
      for (const candidate of categories) {
        const existingJob = await prisma.job.findFirst({ where: { categoryId: candidate.id, status: "active" }, select: { id: true } });
        if (!existingJob) {
          emptyCategory = candidate;
          break;
        }
      }
      if (!emptyCategory) {
        return;
      }

      // If real pre-existing data already fills getOtherPopulatedCategories's
      // own cap, this test's own newly-populated category is not
      // guaranteed a slot — that is the cap correctly doing its job, not
      // a defect, so this scenario is skipped rather than forced.
      const before = await getOtherPopulatedCategories(fixtures.categoryId);
      if (before.length >= 6) {
        return;
      }

      const otherJob = await prisma.job.create({
        data: {
          companyId: fixtures.companyId,
          countryId: fixtures.countryId,
          cityId: fixtures.cityId,
          categoryId: emptyCategory.id,
          postedByUserId: fixtures.userId,
          title: "[AI MODERATION TEST] Other Category Fixture Job",
          description: "A temporary automated-test job for the other-populated-categories test.",
          slug: `ai-mod-test-other-category-${crypto.randomUUID()}`,
          status: "active",
          applicationMethod: "on_platform",
        },
        select: { id: true },
      });
      try {
        const result = await getOtherPopulatedCategories(fixtures.categoryId);
        expect(result.some((c) => c.slug === emptyCategory.slug)).toBe(true);
      } finally {
        await prisma.job.delete({ where: { id: otherJob.id } });
      }
    });
  });
});

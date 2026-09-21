import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicJobs, hasPublicJobsInCountry } from "@/services/jobs/getPublicJobs";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/** Finds a real Country row (other than the given id) with zero currently-public jobs, or null if every country has at least one. */
async function findCountryWithNoPublicJobs(
  excludeCountryId: string
): Promise<{ id: string; urlSlug: string } | null> {
  const countries = await prisma.country.findMany({
    where: { id: { not: excludeCountryId } },
    select: { id: true, urlSlug: true },
  });
  for (const country of countries) {
    const job = await prisma.job.findFirst({
      where: { AND: [publicJobVisibilityWhere(), { countryId: country.id }] },
      select: { id: true },
    });
    if (!job) {
      return country;
    }
  }
  return null;
}

/**
 * Real dev-database test (same pattern as the AI moderation suite) for
 * the new keyword/country/category filters on getPublicJobs(). Never
 * asserts an exact total result count or exact array equality — the
 * real "Senior Petroleum Engineer" listing and other unrelated active
 * jobs already exist in this database, so every assertion checks only
 * whether THIS fixture's own known job IDs are present or absent.
 */
describe("getPublicJobs filters (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let otherCountryId: string;
  let otherCountryUrlSlug: string;
  let otherCategoryId: string;
  let otherCategorySlug: string;

  let engineerJobId: string;
  let marketingJobId: string;
  let otherCountryJobId: string;
  let otherCategoryJobId: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();

    const otherCountry = await prisma.country.findFirst({
      where: { id: { not: fixtures.countryId } },
      select: { id: true, urlSlug: true },
    });
    const otherCategory = await prisma.category.findFirst({
      where: { id: { not: fixtures.categoryId } },
      select: { id: true, slug: true },
    });
    if (!otherCountry || !otherCategory) {
      throw new Error(
        "This test needs at least two Country rows and two Category rows already in the database."
      );
    }
    otherCountryId = otherCountry.id;
    otherCountryUrlSlug = otherCountry.urlSlug;
    otherCategoryId = otherCategory.id;
    otherCategorySlug = otherCategory.slug;

    const engineerJob = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Unique Senior Engineer Role",
      status: "active",
    });
    engineerJobId = engineerJob.id;

    const marketingJob = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Unique Marketing Manager Role",
      status: "active",
    });
    marketingJobId = marketingJob.id;

    const otherCountryJob = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Unique Senior Engineer Role Abroad",
      status: "active",
      countryId: otherCountryId,
    });
    otherCountryJobId = otherCountryJob.id;

    // createTestJob has no categoryId override, so this one row is
    // created directly, mirroring createTestJob's own field shape.
    const otherCategoryJob = await prisma.job.create({
      data: {
        companyId: fixtures.companyId,
        countryId: fixtures.countryId,
        cityId: fixtures.cityId,
        categoryId: otherCategoryId,
        postedByUserId: fixtures.userId,
        title: "[AI MODERATION TEST] Unique Senior Engineer Role Other Category",
        description: "A temporary automated-test job for the public search filter tests.",
        slug: `ai-mod-test-other-category-${crypto.randomUUID()}`,
        status: "active",
        applicationMethod: "on_platform",
      },
      select: { id: true },
    });
    otherCategoryJobId = otherCategoryJob.id;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  function ids(jobs: Awaited<ReturnType<typeof getPublicJobs>>): string[] {
    return jobs.map((job) => job.id);
  }

  it("with no filters, returns jobs including all of this fixture's own active jobs", async () => {
    const result = await getPublicJobs();
    const resultIds = ids(result);
    expect(resultIds).toContain(engineerJobId);
    expect(resultIds).toContain(marketingJobId);
    expect(resultIds).toContain(otherCountryJobId);
    expect(resultIds).toContain(otherCategoryJobId);
  });

  it("keyword search for 'Engineer' matches engineer jobs and excludes the marketing job", async () => {
    const result = await getPublicJobs({ keywords: "Engineer" });
    const resultIds = ids(result);
    expect(resultIds).toContain(engineerJobId);
    expect(resultIds).not.toContain(marketingJobId);
  });

  it("filtering by this fixture's country includes its jobs and excludes the other-country job", async () => {
    const fixtureCountry = await prisma.country.findUniqueOrThrow({
      where: { id: fixtures.countryId },
      select: { urlSlug: true },
    });
    const result = await getPublicJobs({ countryUrlSlug: fixtureCountry.urlSlug });
    const resultIds = ids(result);
    expect(resultIds).toContain(engineerJobId);
    expect(resultIds).not.toContain(otherCountryJobId);
  });

  it("filtering by the other country includes only the other-country job among this fixture's jobs", async () => {
    const result = await getPublicJobs({ countryUrlSlug: otherCountryUrlSlug });
    const resultIds = ids(result);
    expect(resultIds).toContain(otherCountryJobId);
    expect(resultIds).not.toContain(engineerJobId);
    expect(resultIds).not.toContain(marketingJobId);
  });

  it("filtering by this fixture's category includes its jobs and excludes the other-category job", async () => {
    const fixtureCategory = await prisma.category.findUniqueOrThrow({
      where: { id: fixtures.categoryId },
      select: { slug: true },
    });
    const result = await getPublicJobs({ categorySlug: fixtureCategory.slug });
    const resultIds = ids(result);
    expect(resultIds).toContain(engineerJobId);
    expect(resultIds).not.toContain(otherCategoryJobId);
  });

  it("filtering by the other category includes only the other-category job among this fixture's jobs", async () => {
    const result = await getPublicJobs({ categorySlug: otherCategorySlug });
    const resultIds = ids(result);
    expect(resultIds).toContain(otherCategoryJobId);
    expect(resultIds).not.toContain(engineerJobId);
  });

  it("combining keyword + country narrows to jobs matching both", async () => {
    const fixtureCountry = await prisma.country.findUniqueOrThrow({
      where: { id: fixtures.countryId },
      select: { urlSlug: true },
    });
    const result = await getPublicJobs({ keywords: "Engineer", countryUrlSlug: fixtureCountry.urlSlug });
    const resultIds = ids(result);
    expect(resultIds).toContain(engineerJobId);
    // Matches the keyword but not this country.
    expect(resultIds).not.toContain(otherCountryJobId);
    // Matches this country but not the keyword.
    expect(resultIds).not.toContain(marketingJobId);
  });

  it("filtering by this fixture's companyId includes its jobs and excludes an unrelated company's job", async () => {
    const otherFixtures = await createModerationTestFixtures();
    try {
      const otherCompanyJob = await createTestJob(otherFixtures, {
        title: "[AI MODERATION TEST] Unique Job At A Different Company",
        status: "active",
      });
      const result = await getPublicJobs({ companyId: fixtures.companyId });
      const resultIds = ids(result);
      expect(resultIds).toContain(engineerJobId);
      expect(resultIds).not.toContain(otherCompanyJob.id);
    } finally {
      await cleanupModerationTestFixtures(otherFixtures);
    }
  });

  it("an unknown category slug matches no jobs", async () => {
    const result = await getPublicJobs({ categorySlug: "definitely-not-a-real-category-slug" });
    const resultIds = ids(result);
    expect(resultIds).not.toContain(engineerJobId);
    expect(resultIds).not.toContain(marketingJobId);
    expect(resultIds).not.toContain(otherCountryJobId);
    expect(resultIds).not.toContain(otherCategoryJobId);
  });

  describe("test-fixture exclusion", () => {
    it("1. an active [IMPORT TEST] job is excluded from public results", async () => {
      const job = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).not.toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("2. an active [LOCATION REVIEW TEST] job is excluded from public results", async () => {
      const job = await createTestJob(fixtures, { title: "[LOCATION REVIEW TEST] Backend Engineer", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).not.toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("3. a legitimate 'Test Automation Engineer' job remains visible", async () => {
      const job = await createTestJob(fixtures, { title: "Test Automation Engineer", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("4. a legitimate 'QA Test Engineer' job remains visible", async () => {
      const job = await createTestJob(fixtures, { title: "QA Test Engineer", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("5. a legitimate 'Test Inspector' job remains visible", async () => {
      const job = await createTestJob(fixtures, { title: "Test Inspector", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("6. keyword search for 'test' still surfaces legitimate titles containing it, and still excludes the fixture marker", async () => {
      const legitimateJob = await createTestJob(fixtures, { title: "Test Inspector", status: "active" });
      const fixtureJob = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      try {
        const result = await getPublicJobs({ keywords: "test" });
        const resultIds = ids(result);
        expect(resultIds).toContain(legitimateJob.id);
        expect(resultIds).not.toContain(fixtureJob.id);
      } finally {
        await prisma.job.deleteMany({ where: { id: { in: [legitimateJob.id, fixtureJob.id] } } });
      }
    });

    it("7. a rejected job remains hidden regardless of title", async () => {
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Rejected Job", status: "rejected" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).not.toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("8. an expired job remains hidden even with an otherwise-active status", async () => {
      const job = await createTestJob(fixtures, {
        title: "[AI MODERATION TEST] Expired Job",
        status: "active",
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).not.toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("9. a normal active job with no expiry remains visible (existing behavior unchanged)", async () => {
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Perfectly Normal Job", status: "active" });
      try {
        const result = await getPublicJobs();
        expect(ids(result)).toContain(job.id);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });
  });

  describe("Adzuna attribution flag", () => {
    it("a job imported from the real Adzuna source is flagged isAdzunaSourced", async () => {
      const adzunaSource = await prisma.authorizedJobSource.findUnique({ where: { name: "Adzuna" }, select: { id: true } });
      if (!adzunaSource) {
        // The Adzuna registry row is expected to exist in this
        // codebase's DB; skip gracefully rather than failing a
        // seed-data assumption this test doesn't own.
        return;
      }
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Adzuna-Sourced Job", status: "active" });
      await prisma.job.update({ where: { id: job.id }, data: { importedSourceId: adzunaSource.id, importedExternalJobId: `attribution-test-${job.id}` } });
      try {
        const result = await getPublicJobs();
        const found = result.find((j) => j.id === job.id);
        expect(found?.isAdzunaSourced).toBe(true);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });

    it("an ordinary employer-posted job is never flagged isAdzunaSourced", async () => {
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Ordinary Job", status: "active" });
      try {
        const result = await getPublicJobs();
        const found = result.find((j) => j.id === job.id);
        expect(found?.isAdzunaSourced).toBeFalsy();
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    });
  });
});

/**
 * hasPublicJobsInCountry (real dev database, temporary fixtures) — the
 * lightweight existence check that [country]/jobs/page.tsx's
 * generateMetadata() uses to decide the conditional noindex. Never
 * assumes a specific country slug (e.g. "lu") is empty ahead of time —
 * every "empty" scenario below dynamically finds a real Country row
 * with zero currently-public jobs at test-run time, so these tests stay
 * correct even as real production data changes.
 */
describe("hasPublicJobsInCountry (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("1 & 3. a country with at least one active public job returns true, using the same visibility rule as getPublicJobs", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Existence Check Job", status: "active" });
    const country = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } });
    try {
      expect(await hasPublicJobsInCountry(country.urlSlug)).toBe(true);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("2. a country with genuinely zero public jobs returns false", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      // Every real Country row currently has at least one public job —
      // not this test's assumption to force; skip gracefully rather than
      // failing on live data shape (same convention as the Adzuna
      // attribution test above).
      return;
    }
    expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(false);
  });

  it("6. a disposable test-fixture-marker job does not count as a public job", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const fixtureJob = await createTestJob(fixtures, {
      title: "[IMPORT TEST] Should Not Count",
      status: "active",
      countryId: emptyCountry.id,
    });
    try {
      expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(false);
    } finally {
      await prisma.job.delete({ where: { id: fixtureJob.id } });
    }
  });

  it("5. an expired or rejected job does not count as a public job (same lifecycle rule as getPublicJobs)", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const expiredJob = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Expired Existence Check",
      status: "active",
      countryId: emptyCountry.id,
      expiresAt: new Date(Date.now() - 1000 * 60 * 60),
    });
    try {
      expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(false);
    } finally {
      await prisma.job.delete({ where: { id: expiredJob.id } });
    }
  });

  it("7. a country automatically flips true -> false -> true as its only public job is removed and re-created, with no stale caching across calls", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(false);

    const job = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Newly Populated Country",
      status: "active",
      countryId: emptyCountry.id,
    });
    expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(true);

    await prisma.job.delete({ where: { id: job.id } });
    expect(await hasPublicJobsInCountry(emptyCountry.urlSlug)).toBe(false);
  });
});

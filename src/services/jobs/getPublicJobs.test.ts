import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

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

  it("an unknown category slug matches no jobs", async () => {
    const result = await getPublicJobs({ categorySlug: "definitely-not-a-real-category-slug" });
    const resultIds = ids(result);
    expect(resultIds).not.toContain(engineerJobId);
    expect(resultIds).not.toContain(marketingJobId);
    expect(resultIds).not.toContain(otherCountryJobId);
    expect(resultIds).not.toContain(otherCategoryJobId);
  });
});

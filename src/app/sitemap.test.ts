import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { prisma } from "@/lib/prisma";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import { OIL_AND_GAS_CATEGORY_SLUGS } from "@/services/jobs/getOilAndGasHub";
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

/** Finds a real Category row (other than the given id) with zero currently-public jobs, or null if every category has at least one. */
async function findCategoryWithNoPublicJobs(
  excludeCategoryId: string
): Promise<{ id: string; slug: string } | null> {
  const categories = await prisma.category.findMany({
    where: { id: { not: excludeCategoryId } },
    select: { id: true, slug: true },
  });
  for (const category of categories) {
    const job = await prisma.job.findFirst({
      where: { AND: [publicJobVisibilityWhere(), { categoryId: category.id }] },
      select: { id: true },
    });
    if (!job) {
      return category;
    }
  }
  return null;
}

async function createJobInCategory(fixtures: ModerationTestFixtures, categoryId: string, title: string) {
  return prisma.job.create({
    data: {
      companyId: fixtures.companyId,
      countryId: fixtures.countryId,
      cityId: fixtures.cityId,
      categoryId,
      postedByUserId: fixtures.userId,
      title,
      description: "A temporary automated-test job for the sitemap category tests.",
      slug: `sitemap-category-test-${crypto.randomUUID()}`,
      status: "active",
      applicationMethod: "on_platform",
    },
    select: { id: true },
  });
}

function urls(entries: Awaited<ReturnType<typeof sitemap>>): string[] {
  return entries.map((entry) => entry.url);
}

/**
 * app/sitemap.ts (real dev database, temporary fixtures). sitemap()
 * falls back to reading the request's own Host header via next/headers
 * when NEXT_PUBLIC_SITE_URL is unset (see getSiteOrigin.ts) — there is
 * no request context in a unit test, so this suite sets the env var for
 * its own duration only, exactly like production would once configured,
 * rather than mocking next/headers (no existing precedent for that in
 * this codebase, and mocking it would be a new architecture for a
 * one-line env fallback this task does not need to touch).
 */
describe("sitemap (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sitemap-test.invalid";
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    await cleanupModerationTestFixtures(fixtures);
  });

  it("10. always includes the existing static marketing/legal pages, unaffected by the country-filtering change", async () => {
    const entries = urls(await sitemap());
    expect(entries).toContain("https://sitemap-test.invalid/");
    expect(entries).toContain("https://sitemap-test.invalid/jobs");
    expect(entries).toContain("https://sitemap-test.invalid/about");
    expect(entries).toContain("https://sitemap-test.invalid/privacy");
    expect(entries).toContain("https://sitemap-test.invalid/terms");
  });

  it("9. a country with at least one active public job is included as /{country}/jobs, alongside its own job entry", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Sitemap Inclusion Check", status: "active" });
    const jobRow = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true } });
    const country = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } });
    try {
      const entries = urls(await sitemap());
      expect(entries).toContain(`https://sitemap-test.invalid/${country.urlSlug}/jobs`);
      expect(entries).toContain(`https://sitemap-test.invalid/${country.urlSlug}/jobs/${jobRow.slug}`);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("8. a country with genuinely zero public jobs is excluded from the sitemap", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const entries = urls(await sitemap());
    expect(entries).not.toContain(`https://sitemap-test.invalid/${emptyCountry.urlSlug}/jobs`);
  });

  it("6. a disposable test-fixture-marker job does not make its otherwise-empty country appear in the sitemap", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const fixtureJob = await createTestJob(fixtures, {
      title: "[IMPORT TEST] Should Not Appear",
      status: "active",
      countryId: emptyCountry.id,
    });
    try {
      const entries = urls(await sitemap());
      expect(entries).not.toContain(`https://sitemap-test.invalid/${emptyCountry.urlSlug}/jobs`);
    } finally {
      await prisma.job.delete({ where: { id: fixtureJob.id } });
    }
  });

  it("7. a country automatically appears in and disappears from the sitemap as its only public job is created and removed", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const countryUrl = `https://sitemap-test.invalid/${emptyCountry.urlSlug}/jobs`;

    expect(urls(await sitemap())).not.toContain(countryUrl);

    const job = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Newly Sitemap-Eligible Country",
      status: "active",
      countryId: emptyCountry.id,
    });
    expect(urls(await sitemap())).toContain(countryUrl);

    await prisma.job.delete({ where: { id: job.id } });
    expect(urls(await sitemap())).not.toContain(countryUrl);
  });

  it("10. a category with at least one active public job is included as /category/{slug}", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Sitemap Category Inclusion Check", status: "active" });
    const category = await prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { slug: true } });
    try {
      const entries = urls(await sitemap());
      expect(entries).toContain(`https://sitemap-test.invalid/category/${category.slug}`);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("11. a category with genuinely zero public jobs is excluded from the sitemap", async () => {
    const emptyCategory = await findCategoryWithNoPublicJobs(fixtures.categoryId);
    if (!emptyCategory) {
      return;
    }
    const entries = urls(await sitemap());
    expect(entries).not.toContain(`https://sitemap-test.invalid/category/${emptyCategory.slug}`);
  });

  it("a category automatically appears in and disappears from the sitemap as its only public job is created and removed", async () => {
    const emptyCategory = await findCategoryWithNoPublicJobs(fixtures.categoryId);
    if (!emptyCategory) {
      return;
    }
    const categoryUrl = `https://sitemap-test.invalid/category/${emptyCategory.slug}`;

    expect(urls(await sitemap())).not.toContain(categoryUrl);

    const job = await createJobInCategory(fixtures, emptyCategory.id, "[AI MODERATION TEST] Newly Sitemap-Eligible Category");
    expect(urls(await sitemap())).toContain(categoryUrl);

    await prisma.job.delete({ where: { id: job.id } });
    expect(urls(await sitemap())).not.toContain(categoryUrl);
  });

  it("a disposable test-fixture-marker job does not make its otherwise-empty category appear in the sitemap", async () => {
    const emptyCategory = await findCategoryWithNoPublicJobs(fixtures.categoryId);
    if (!emptyCategory) {
      return;
    }
    const fixtureJob = await createJobInCategory(fixtures, emptyCategory.id, "[IMPORT TEST] Should Not Appear");
    try {
      const entries = urls(await sitemap());
      expect(entries).not.toContain(`https://sitemap-test.invalid/category/${emptyCategory.slug}`);
    } finally {
      await prisma.job.delete({ where: { id: fixtureJob.id } });
    }
  });

  it("12 & 13. the Oil & Gas hub automatically appears in and disappears from the sitemap as its only qualifying job is created and removed", async () => {
    const hubUrl = "https://sitemap-test.invalid/oil-and-gas";
    const oilGasCategory = await prisma.category.findUniqueOrThrow({ where: { slug: OIL_AND_GAS_CATEGORY_SLUGS[0] }, select: { id: true } });
    const existingJob = await prisma.job.findFirst({
      where: { AND: [publicJobVisibilityWhere(), { category: { slug: { in: [...OIL_AND_GAS_CATEGORY_SLUGS] } } }] },
      select: { id: true },
    });
    if (existingJob) {
      // The real dev DB already has a qualifying job — confirm the hub
      // is present, without forcing the 0->1 transition on top of it.
      expect(urls(await sitemap())).toContain(hubUrl);
      return;
    }

    expect(urls(await sitemap())).not.toContain(hubUrl);

    const job = await createJobInCategory(fixtures, oilGasCategory.id, "[AI MODERATION TEST] Newly Sitemap-Eligible Oil & Gas Hub");
    expect(urls(await sitemap())).toContain(hubUrl);

    await prisma.job.delete({ where: { id: job.id } });
    expect(urls(await sitemap())).not.toContain(hubUrl);
  });

  it("a disposable test-fixture-marker job does not make an otherwise-empty Oil & Gas hub appear in the sitemap", async () => {
    const existingJob = await prisma.job.findFirst({
      where: { AND: [publicJobVisibilityWhere(), { category: { slug: { in: [...OIL_AND_GAS_CATEGORY_SLUGS] } } }] },
      select: { id: true },
    });
    if (existingJob) {
      return;
    }
    const oilGasCategory = await prisma.category.findUniqueOrThrow({ where: { slug: OIL_AND_GAS_CATEGORY_SLUGS[0] }, select: { id: true } });
    const fixtureJob = await createJobInCategory(fixtures, oilGasCategory.id, "[IMPORT TEST] Should Not Appear In Oil & Gas Hub");
    try {
      expect(urls(await sitemap())).not.toContain("https://sitemap-test.invalid/oil-and-gas");
    } finally {
      await prisma.job.delete({ where: { id: fixtureJob.id } });
    }
  });

  it("a Mechanical Engineering job never makes the Oil & Gas hub appear in the sitemap — it is not a qualifying category", async () => {
    const existingJob = await prisma.job.findFirst({
      where: { AND: [publicJobVisibilityWhere(), { category: { slug: { in: [...OIL_AND_GAS_CATEGORY_SLUGS] } } }] },
      select: { id: true },
    });
    if (existingJob) {
      return;
    }
    const mechanicalEngineering = await prisma.category.findUniqueOrThrow({
      where: { slug: "mechanical-engineering" },
      select: { id: true },
    });
    const job = await createJobInCategory(fixtures, mechanicalEngineering.id, "[AI MODERATION TEST] Unrelated Category Check");
    try {
      expect(urls(await sitemap())).not.toContain("https://sitemap-test.invalid/oil-and-gas");
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });
});

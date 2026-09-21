import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { prisma } from "@/lib/prisma";
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
});

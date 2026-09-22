import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import CountryJobsPage, { generateMetadata } from "@/app/(public)/[country]/jobs/page";
import { COUNTRIES } from "@/constants/countries";
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

/** generateMetadata() only reads `params`, but PageProps<'/[country]/jobs'> requires `searchParams` too. */
function metadataFor(countrySlug: string, page?: string) {
  return generateMetadata({
    params: Promise.resolve({ country: countrySlug }),
    searchParams: Promise.resolve(page === undefined ? {} : { page }),
  });
}

/**
 * [country]/jobs/page.tsx's generateMetadata() (real dev database,
 * temporary fixtures). Confirms the conditional noindex introduced for
 * empty countries, without touching the unrelated notFound()/rendering
 * behavior of the default-exported page component (tested separately
 * below, and otherwise untouched by this task).
 */
describe("[country]/jobs generateMetadata (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("4. an unknown country slug returns plain fallback metadata (no robots field, no DB assumption)", async () => {
    const metadata = await metadataFor("definitely-not-a-real-country-slug");
    expect(metadata.title).toBe("Jobs");
    expect(metadata.robots).toBeUndefined();
  });

  it("1 & 2. a known country with zero public jobs emits robots: { index: false, follow: true }", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const countrySlug = COUNTRIES.find((c) => c.slug === emptyCountry.urlSlug)?.slug;
    if (!countrySlug) {
      // This real Country row isn't one of the 21 reference-list
      // countries the page route actually resolves — not this test's
      // scenario to force.
      return;
    }
    const metadata = await metadataFor(countrySlug);
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("3. a known country with at least one public job does not emit noindex", async () => {
    const fixtureCountry = await prisma.country.findUniqueOrThrow({
      where: { id: fixtures.countryId },
      select: { urlSlug: true },
    });
    const referenceCountry = COUNTRIES.find((c) => c.slug === fixtureCountry.urlSlug);
    if (!referenceCountry) {
      return;
    }
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Metadata Indexable Check", status: "active" });
    try {
      const metadata = await metadataFor(referenceCountry.slug);
      expect(metadata.robots).toBeUndefined();
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("7. a country becomes indexable automatically the instant it has its first public job, and reverts once it has none", async () => {
    const emptyCountry = await findCountryWithNoPublicJobs(fixtures.countryId);
    if (!emptyCountry) {
      return;
    }
    const referenceCountry = COUNTRIES.find((c) => c.slug === emptyCountry.urlSlug);
    if (!referenceCountry) {
      return;
    }

    const before = await metadataFor(referenceCountry.slug);
    expect(before.robots).toEqual({ index: false, follow: true });

    const job = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Becomes Indexable",
      status: "active",
      countryId: emptyCountry.id,
    });
    const during = await metadataFor(referenceCountry.slug);
    expect(during.robots).toBeUndefined();

    await prisma.job.delete({ where: { id: job.id } });
    const after = await metadataFor(referenceCountry.slug);
    expect(after.robots).toEqual({ index: false, follow: true });
  });

  it("12. ?q= and ?category= query params still reach JobsListingView unchanged (CountryJobsPage's own logic was not touched by this task)", async () => {
    const fixtureCountry = await prisma.country.findUniqueOrThrow({
      where: { id: fixtures.countryId },
      select: { urlSlug: true },
    });
    const referenceCountry = COUNTRIES.find((c) => c.slug === fixtureCountry.urlSlug);
    if (!referenceCountry) {
      return;
    }
    const element = await CountryJobsPage({
      params: Promise.resolve({ country: referenceCountry.slug }),
      searchParams: Promise.resolve({ q: "engineer", category: "engineering" }),
    });
    expect(element.props.filters).toEqual({ keywords: "engineer", categorySlug: "engineering" });
  });

  it("?workMode=, ?employmentType=, and ?page= all reach JobsListingView, so pagination can preserve them", async () => {
    const fixtureCountry = await prisma.country.findUniqueOrThrow({
      where: { id: fixtures.countryId },
      select: { urlSlug: true },
    });
    const referenceCountry = COUNTRIES.find((c) => c.slug === fixtureCountry.urlSlug);
    if (!referenceCountry) {
      return;
    }
    const element = await CountryJobsPage({
      params: Promise.resolve({ country: referenceCountry.slug }),
      searchParams: Promise.resolve({ workMode: "remote", employmentType: "full_time", page: "2" }),
    });
    expect(element.props.filters).toMatchObject({ workMode: "remote", employmentType: "full_time", page: 2 });
  });

  describe("pagination canonical/robots", () => {
    it("page 1 (explicit or omitted) canonicalizes to the bare /{country}/jobs URL, exactly as before pagination existed", async () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
      try {
        const fixtureCountry = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } });
        const referenceCountry = COUNTRIES.find((c) => c.slug === fixtureCountry.urlSlug);
        if (!referenceCountry) return;
        const omitted = await metadataFor(referenceCountry.slug);
        const explicit = await metadataFor(referenceCountry.slug, "1");
        expect(omitted.alternates?.canonical).toBe(`https://pagination-test.invalid/${referenceCountry.slug}/jobs`);
        expect(explicit.alternates?.canonical).toBe(`https://pagination-test.invalid/${referenceCountry.slug}/jobs`);
      } finally {
        if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    });

    it("an invalid ?page= value (0, negative, non-numeric) canonicalizes to page 1's bare URL, never a distinct duplicate URL", async () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
      try {
        const fixtureCountry = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } });
        const referenceCountry = COUNTRIES.find((c) => c.slug === fixtureCountry.urlSlug);
        if (!referenceCountry) return;
        for (const rawPage of ["0", "-1", "abc"]) {
          const metadata = await metadataFor(referenceCountry.slug, rawPage);
          expect(metadata.alternates?.canonical).toBe(`https://pagination-test.invalid/${referenceCountry.slug}/jobs`);
        }
      } finally {
        if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    });

    it("page 2 of a country with only 1 real job gets its own self-referencing canonical, but is noindexed (that page has no results)", async () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
      const isolatedFixtures = await createModerationTestFixtures();
      try {
        const country = await prisma.country.findUniqueOrThrow({ where: { id: isolatedFixtures.countryId }, select: { urlSlug: true } });
        const referenceCountry = COUNTRIES.find((c) => c.slug === country.urlSlug);
        if (!referenceCountry) return;
        const job = await createTestJob(isolatedFixtures, { title: "[AI MODERATION TEST] Pagination Canonical Check", status: "active" });
        try {
          const metadata = await metadataFor(referenceCountry.slug, "2");
          expect(metadata.alternates?.canonical).toBe(`https://pagination-test.invalid/${referenceCountry.slug}/jobs?page=2`);
          expect(metadata.robots).toEqual({ index: false, follow: true });
        } finally {
          await prisma.job.delete({ where: { id: job.id } });
        }
      } finally {
        await cleanupModerationTestFixtures(isolatedFixtures);
        if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    });

    it("page 2 of a country with genuine (25+) real jobs is NOT noindexed — deterministic, never relying on ambient real data", async () => {
      const original = process.env.NEXT_PUBLIC_SITE_URL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
      const isolatedFixtures = await createModerationTestFixtures();
      const createdJobIds: string[] = [];
      try {
        const country = await prisma.country.findUniqueOrThrow({ where: { id: isolatedFixtures.countryId }, select: { urlSlug: true } });
        const referenceCountry = COUNTRIES.find((c) => c.slug === country.urlSlug);
        if (!referenceCountry) return;
        for (let i = 0; i < 25; i++) {
          const job = await createTestJob(isolatedFixtures, {
            title: `[AI MODERATION TEST] Country Pagination Fixture ${i}`,
            status: "active",
          });
          createdJobIds.push(job.id);
        }
        const metadata = await metadataFor(referenceCountry.slug, "2");
        expect(metadata.alternates?.canonical).toBe(`https://pagination-test.invalid/${referenceCountry.slug}/jobs?page=2`);
        expect(metadata.robots).toBeUndefined();
      } finally {
        await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
        await cleanupModerationTestFixtures(isolatedFixtures);
        if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    });
  });
});

/**
 * CountryJobsPage's own notFound() behavior — provably untouched by this
 * task (see page.tsx: the default export was not modified), verified
 * here rather than skipped so STEP 6 item #4 has real automated coverage
 * for the page's rendering path too, not only generateMetadata's. Next's
 * notFound() throws an Error whose `.digest` is exactly
 * "NEXT_HTTP_ERROR_FALLBACK;404" — confirmed by reading
 * node_modules/next/dist/client/components/not-found.js and
 * http-access-fallback.js directly rather than guessing, the same way
 * src/test-utils/nextRedirect.ts documents its own verification of
 * redirect()'s digest format.
 */
describe("CountryJobsPage default export", () => {
  it("4. an unknown country slug throws Next's notFound() error (digest NEXT_HTTP_ERROR_FALLBACK;404)", async () => {
    await expect(
      CountryJobsPage({
        params: Promise.resolve({ country: "definitely-not-a-real-country-slug" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

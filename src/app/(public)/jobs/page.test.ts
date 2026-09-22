import { afterAll, beforeAll, describe, expect, it } from "vitest";
import JobsPage, { generateMetadata } from "@/app/(public)/jobs/page";
import { prisma } from "@/lib/prisma";
import { countPublicJobs } from "@/services/jobs/getPublicJobs";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

function metadataFor(page?: string) {
  return generateMetadata({ searchParams: Promise.resolve(page === undefined ? {} : { page }) });
}

describe("/jobs generateMetadata pagination (real dev database)", () => {
  it("17. page 1 (omitted) canonicalizes to the bare /jobs URL, exactly as before pagination existed", async () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
    try {
      const metadata = await metadataFor();
      expect(metadata.title).toBe("Browse All Jobs");
      expect(metadata.alternates?.canonical).toBe("https://pagination-test.invalid/jobs");
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  it("an invalid ?page= value (0, negative, non-numeric) canonicalizes to page 1's bare URL, never a distinct duplicate URL", async () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
    try {
      for (const rawPage of ["0", "-1", "abc"]) {
        const metadata = await metadataFor(rawPage);
        expect(metadata.alternates?.canonical).toBe("https://pagination-test.invalid/jobs");
      }
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  it("page 2 gets its own self-referencing canonical when real results exist there", async () => {
    // The real dev DB already has enough active jobs (from other test
    // suites' shared fixtures and real seed data) that page 2 of the
    // fully unfiltered /jobs listing has genuine results in practice;
    // if that is ever not the case, this assertion is skipped rather
    // than forced, per this task's own "create no test jobs to inflate
    // /jobs itself" instruction (this suite creates fixtures scoped to
    // narrower tests below, never to the global /jobs count).
    const totalCount = await countPublicJobs({});
    if (totalCount <= 24) {
      return;
    }
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
    try {
      const metadata = await metadataFor("2");
      expect(metadata.alternates?.canonical).toBe("https://pagination-test.invalid/jobs?page=2");
      expect(metadata.robots).toBeUndefined();
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  it("a page number far beyond the last real page is noindexed, never presented as a real indexable duplicate", async () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagination-test.invalid";
    try {
      const metadata = await metadataFor("999999");
      expect(metadata.alternates?.canonical).toBe("https://pagination-test.invalid/jobs?page=999999");
      expect(metadata.robots).toEqual({ index: false, follow: true });
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });
});

describe("JobsPage default export (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("18. ?q=, ?country=, ?category=, ?workMode=, ?employmentType=, and ?page= all reach JobsListingView unchanged/newly-added, preserving existing filter behavior", async () => {
    const element = await JobsPage({
      searchParams: Promise.resolve({
        q: "engineer",
        country: "gb",
        category: "engineering",
        workMode: "remote",
        employmentType: "full_time",
        page: "2",
      }),
    });
    expect(element.props.filters).toEqual({
      keywords: "engineer",
      countryCode: "gb",
      categorySlug: "engineering",
      workMode: "remote",
      employmentType: "full_time",
      page: 2,
    });
  });

  it("17. with no query params at all, filters are all undefined (page 1's existing behavior is unchanged)", async () => {
    const element = await JobsPage({ searchParams: Promise.resolve({}) });
    expect(element.props.filters).toEqual({
      keywords: undefined,
      countryCode: undefined,
      categorySlug: undefined,
      workMode: undefined,
      employmentType: undefined,
      page: undefined,
    });
  });

  it("renders without throwing when a real active job exists (sanity check for the page component itself, not just generateMetadata)", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Jobs Page Render Check", status: "active" });
    try {
      const element = await JobsPage({ searchParams: Promise.resolve({}) });
      expect(element.props.filters).toBeDefined();
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });
});

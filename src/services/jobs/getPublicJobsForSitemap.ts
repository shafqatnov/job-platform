import { prisma } from "@/lib/prisma";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";

export type SitemapJobEntry = {
  slug: string;
  countryUrlSlug: string;
  categorySlug: string;
  updatedAt: Date;
};

// A generous safety cap, not a guessed/arbitrary business limit — avoids
// an unbounded sitemap if job volume grows very large, without
// artificially truncating any realistic launch-scale amount of listings.
const SITEMAP_JOB_LIMIT = 5000;

/**
 * Reads every currently publicly-visible job for sitemap.xml, in a
 * single query across all countries (never one query per country —
 * that would be N+1 across the country list). Applies the exact same
 * centralized public-visibility rule as getPublicJobs.ts — see
 * publicJobVisibility.ts, the one shared source of truth for this rule
 * (status = active, not soft-deleted, not past expiry, not a known
 * disposable test-fixture) — so a search engine can never index a
 * leftover test job either. Also carries each job's own countryUrlSlug
 * and categorySlug so sitemap.ts can derive "which countries/categories
 * currently have public jobs" from this same result set, with zero
 * additional queries.
 */
export async function getPublicJobsForSitemap(): Promise<SitemapJobEntry[]> {
  const jobs = await prisma.job.findMany({
    where: publicJobVisibilityWhere(),
    select: {
      slug: true,
      updatedAt: true,
      country: { select: { urlSlug: true } },
      category: { select: { slug: true } },
    },
    orderBy: { postedAt: "desc" },
    take: SITEMAP_JOB_LIMIT,
  });

  return jobs.map((job) => ({
    slug: job.slug,
    countryUrlSlug: job.country.urlSlug,
    categorySlug: job.category.slug,
    updatedAt: job.updatedAt,
  }));
}

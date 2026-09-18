import { prisma } from "@/lib/prisma";

export type SitemapJobEntry = {
  slug: string;
  countryUrlSlug: string;
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
 * publish-visibility rule as src/services/jobs/getPublicJobs.ts
 * (status = active, not soft-deleted, not past expiry).
 *
 * This rule is intentionally duplicated here rather than importing
 * from getPublicJobs.ts: this task's scope is additive-only, and
 * refactoring the existing, working public listing query's internals
 * to share this logic was judged higher-risk than a few duplicated
 * lines of a rule that rarely changes. If the lifecycle rule changes,
 * both this file and getPublicJobs.ts need the same edit.
 */
export async function getPublicJobsForSitemap(): Promise<SitemapJobEntry[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: "active",
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      slug: true,
      updatedAt: true,
      country: { select: { urlSlug: true } },
    },
    orderBy: { postedAt: "desc" },
    take: SITEMAP_JOB_LIMIT,
  });

  return jobs.map((job) => ({
    slug: job.slug,
    countryUrlSlug: job.country.urlSlug,
    updatedAt: job.updatedAt,
  }));
}

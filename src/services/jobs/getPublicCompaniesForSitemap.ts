import { prisma } from "@/lib/prisma";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";

export type SitemapCompanyEntry = {
  slug: string;
  updatedAt: Date;
};

// Mirrors getPublicJobsForSitemap.ts's own safety cap exactly — a
// generous ceiling, not a guessed business limit.
const SITEMAP_COMPANY_LIMIT = 5000;

/**
 * Reads every company that currently has at least one genuinely
 * public job, for sitemap.xml — the same "does this company get an
 * indexable page" rule getPublicCompanyBySlug.ts itself uses. One
 * query (never per-company), deduped by company slug keeping the most
 * recently updated job's timestamp as that company's own lastModified.
 */
export async function getPublicCompaniesForSitemap(): Promise<SitemapCompanyEntry[]> {
  const jobs = await prisma.job.findMany({
    where: publicJobVisibilityWhere(),
    select: { updatedAt: true, company: { select: { slug: true } } },
    orderBy: { updatedAt: "desc" },
    take: SITEMAP_COMPANY_LIMIT,
  });

  const seen = new Map<string, SitemapCompanyEntry>();
  for (const job of jobs) {
    if (!seen.has(job.company.slug)) {
      seen.set(job.company.slug, { slug: job.company.slug, updatedAt: job.updatedAt });
    }
  }

  return Array.from(seen.values());
}

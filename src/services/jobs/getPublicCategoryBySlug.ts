import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { findCategoryBySlug } from "@/services/jobs/referenceData";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";

/**
 * Read-only public category-landing data — the layer behind
 * /category/[slug]. Reuses the real Category table (the same one every
 * Job.categoryId already points to, read via referenceData.ts's own
 * findCategoryBySlug — never src/constants/categories.ts, which is only
 * an illustrative UI reference list) and the same centralized
 * publicJobVisibilityWhere() rule as every other public read.
 *
 * Unlike getPublicCompanyBySlug.ts, this returns non-null even when the
 * category currently has zero public jobs: a category, unlike a
 * company, is a stable piece of reference data that should stay a real,
 * reachable, 200-status page (with a conditional noindex — see
 * /category/[slug]/page.tsx's generateMetadata) exactly like an empty
 * country page, per [country]/jobs/page.tsx's own precedent. Only an
 * unknown slug (no matching Category row at all) returns null, driving
 * the route's genuine 404.
 */

export type PublicCategoryHiringCountry = { name: string; slug: string };
export type PublicCategoryHiringCompany = { name: string; slug: string; openJobCount: number };

export type PublicCategoryDetail = {
  id: string;
  slug: string;
  name: string;
  openJobCount: number;
  hiringCountries: PublicCategoryHiringCountry[];
  hiringCompanies: PublicCategoryHiringCompany[];
};

function dedupeByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.set(k, item);
    }
  }
  return Array.from(seen.values());
}

/**
 * Wrapped in React's cache() — same pattern as getSessionUser.ts and
 * hasPublicJobsInCountry — so /category/[slug]/page.tsx's
 * generateMetadata() and its default-exported page component (which
 * both need this same category's data) share one set of queries per
 * request instead of running them twice.
 */
export const getPublicCategoryBySlug = cache(async (slug: string): Promise<PublicCategoryDetail | null> => {
  const category = await findCategoryBySlug(slug);
  if (!category) {
    return null;
  }

  const jobs = await prisma.job.findMany({
    where: { AND: [publicJobVisibilityWhere(), { categoryId: category.id }] },
    select: {
      country: { select: { name: true, urlSlug: true } },
      company: { select: { slug: true, name: true } },
    },
  });

  const hiringCountries = dedupeByKey(
    jobs.map((job) => ({ name: job.country.name, slug: job.country.urlSlug })),
    (c) => c.slug
  );

  const companyCounts = new Map<string, PublicCategoryHiringCompany>();
  for (const job of jobs) {
    const existing = companyCounts.get(job.company.slug);
    if (existing) {
      existing.openJobCount += 1;
    } else {
      companyCounts.set(job.company.slug, { name: job.company.name, slug: job.company.slug, openJobCount: 1 });
    }
  }

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    openJobCount: jobs.length,
    hiringCountries,
    hiringCompanies: Array.from(companyCounts.values()),
  };
});

export type RelatedCategory = { slug: string; name: string; openJobCount: number };

const RELATED_CATEGORIES_LIMIT = 6;

/**
 * Other categories that currently have at least one genuinely public
 * job — used for the "other categories" section, never the unused
 * Category.parentCategoryId hierarchy (confirmed empty in this database:
 * no real relationship to derive "related" from there today). A single
 * grouped query, not one per category.
 */
export async function getOtherPopulatedCategories(excludeCategoryId: string): Promise<RelatedCategory[]> {
  const jobs = await prisma.job.findMany({
    where: { AND: [publicJobVisibilityWhere(), { categoryId: { not: excludeCategoryId } }] },
    select: { category: { select: { id: true, slug: true, name: true } } },
  });

  const counts = new Map<string, RelatedCategory>();
  for (const job of jobs) {
    const existing = counts.get(job.category.id);
    if (existing) {
      existing.openJobCount += 1;
    } else {
      counts.set(job.category.id, { slug: job.category.slug, name: job.category.name, openJobCount: 1 });
    }
  }

  return Array.from(counts.values()).slice(0, RELATED_CATEGORIES_LIMIT);
}

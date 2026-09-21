import { prisma } from "@/lib/prisma";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import { findAdzunaSourceId } from "@/services/jobs/adzunaAttribution";

export type PublicJobDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  companyName: string;
  /** For linking to the company's own /company/[slug] profile page — always present (Company.slug is required/unique), never optional. */
  companySlug: string;
  companyWebsiteUrl?: string;
  countryCode: string;
  countrySlug: string;
  countryName: string;
  city: string;
  categoryName: string;
  categorySlug: string;
  skills: string[];
  salaryMin?: number;
  salaryMax?: number;
  currencyCode?: string;
  postedAt: string;
  expiresAt?: string;
  applicationMethod: "on_platform" | "external_url";
  externalApplicationUrl?: string;
  /** True only for a listing imported from the Adzuna source — see adzunaAttribution.ts. Drives the mandatory "Jobs by Adzuna" attribution (AdzunaAttribution.tsx). */
  isAdzunaSourced?: boolean;
};

export type GetPublicJobBySlugOptions = {
  countryUrlSlug: string;
  jobSlug: string;
};

/**
 * Reads exactly one publicly publishable job for the job-detail page, by
 * country URL slug + job slug — never by internal id (see
 * docs/04-routing-and-url-strategy.md). Applies the exact same
 * centralized public-visibility rule as getPublicJobs.ts (see
 * publicJobVisibility.ts) — status = active, not soft-deleted, not past
 * its expiry date, and not a known disposable test-fixture. Filtering by
 * the job's actual country relation, not just matching the slug, ensures
 * a job can never be reached through the wrong country's URL.
 *
 * Returns null when no such publishable job exists; the caller decides
 * what to do with that (this function never calls notFound() itself).
 * Errors are intentionally not caught — a genuine database failure must
 * propagate to the route's error boundary, not be presented as "not
 * found."
 */
export async function getPublicJobBySlug(
  options: GetPublicJobBySlugOptions
): Promise<PublicJobDetail | null> {
  const job = await prisma.job.findFirst({
    where: {
      AND: [publicJobVisibilityWhere(), { slug: options.jobSlug }, { country: { urlSlug: options.countryUrlSlug } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      salaryMin: true,
      salaryMax: true,
      currencyCode: true,
      postedAt: true,
      createdAt: true,
      expiresAt: true,
      importedSourceId: true,
      company: { select: { name: true, slug: true, websiteUrl: true } },
      country: { select: { isoCode: true, urlSlug: true, name: true } },
      city: { select: { name: true } },
      category: { select: { name: true, slug: true } },
      jobSkills: { select: { skill: { select: { name: true } } } },
    },
  });

  if (!job) {
    return null;
  }

  const adzunaSourceId = await findAdzunaSourceId();

  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    description: job.description,
    companyName: job.company.name,
    companySlug: job.company.slug,
    companyWebsiteUrl: job.company.websiteUrl ?? undefined,
    countryCode: job.country.isoCode,
    countrySlug: job.country.urlSlug,
    countryName: job.country.name,
    city: job.city.name,
    categoryName: job.category.name,
    categorySlug: job.category.slug,
    skills: job.jobSkills.map((jobSkill) => jobSkill.skill.name),
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    currencyCode: job.currencyCode ?? undefined,
    postedAt: (job.postedAt ?? job.createdAt).toISOString(),
    expiresAt: job.expiresAt ? job.expiresAt.toISOString() : undefined,
    applicationMethod: job.applicationMethod,
    externalApplicationUrl: job.externalApplicationUrl ?? undefined,
    isAdzunaSourced: adzunaSourceId !== null && job.importedSourceId === adzunaSourceId,
  };
}

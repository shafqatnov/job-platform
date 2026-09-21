import { prisma } from "@/lib/prisma";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";

/**
 * Read-only public company-profile data — the source-agnostic layer
 * behind /company/[slug]. Reuses the existing Company and Job models
 * exactly as they are (no schema change): a company profile is not a
 * new data concept, only a new READ shaped around the same Company row
 * every existing flow already writes to (employer self-service edits
 * via updateEmployerCompany.ts, or getOrCreateImportedCompany inside
 * publishImportedJob.ts for Adzuna/Greenhouse/any future ATS source —
 * see that file's own doc comment: an imported company NEVER gets an
 * EmployerProfile, but it IS a real Company row all the same, so it
 * works here with zero special-casing per source).
 *
 * "Factual overview" fields (description, websiteUrl, logoUrl) are
 * rendered only when actually present on the row — never invented,
 * never templated, never AI-generated. For an Adzuna/Greenhouse-sourced
 * company these are always null today (getOrCreateImportedCompany only
 * ever sets name+slug), which is the correct, honest state to show —
 * callers must omit that section entirely rather than guess.
 */

export type PublicCompanyHiringLocation = { name: string; slug: string };
export type PublicCompanyHiringCategory = { name: string; slug: string };

export type PublicCompanyDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  openJobCount: number;
  hiringCountries: PublicCompanyHiringLocation[];
  hiringCategories: PublicCompanyHiringCategory[];
};

/**
 * Returns null both when no Company row matches this slug AND when one
 * exists but currently has zero genuinely public jobs (same
 * publicJobVisibilityWhere() rule getPublicJobs.ts/getPublicJobBySlug.ts
 * already use) — a company with nothing currently hiring gets no
 * indexable profile page, exactly like an individual job that's expired
 * or unpublished already 404s today. This also means a leftover
 * disposable test-fixture company (excluded by the same rule's title-
 * marker check on its jobs) can never surface a real page either.
 */
export async function getPublicCompanyBySlug(slug: string): Promise<PublicCompanyDetail | null> {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, description: true, websiteUrl: true, logoUrl: true },
  });
  if (!company) {
    return null;
  }

  const jobs = await prisma.job.findMany({
    where: { AND: [publicJobVisibilityWhere(), { companyId: company.id }] },
    select: {
      country: { select: { name: true, urlSlug: true } },
      category: { select: { name: true, slug: true } },
    },
  });
  if (jobs.length === 0) {
    return null;
  }

  const hiringCountries = dedupeByKey(
    jobs.map((job) => ({ name: job.country.name, slug: job.country.urlSlug })),
    (c) => c.slug
  );
  const hiringCategories = dedupeByKey(
    jobs.map((job) => ({ name: job.category.name, slug: job.category.slug })),
    (c) => c.slug
  );

  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    description: company.description ?? undefined,
    websiteUrl: company.websiteUrl ?? undefined,
    logoUrl: company.logoUrl ?? undefined,
    openJobCount: jobs.length,
    hiringCountries,
    hiringCategories,
  };
}

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

export type RelatedCompany = { id: string; slug: string; name: string; openJobCount: number };

const RELATED_COMPANIES_LIMIT = 6;

/**
 * Other companies currently hiring in at least one of the same
 * categories as the given company — used for the "related companies"
 * section. Never includes the company itself. Uses the same
 * publicJobVisibilityWhere() rule, so a related company only ever
 * appears here if it too currently has a genuinely public job (never a
 * company with zero real open jobs, and never a disposable test
 * fixture).
 */
export async function getRelatedCompanies(
  excludeCompanyId: string,
  categorySlugs: string[]
): Promise<RelatedCompany[]> {
  if (categorySlugs.length === 0) {
    return [];
  }

  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        publicJobVisibilityWhere(),
        { category: { slug: { in: categorySlugs } } },
        { companyId: { not: excludeCompanyId } },
      ],
    },
    select: { company: { select: { id: true, slug: true, name: true } } },
  });

  const counts = new Map<string, RelatedCompany>();
  for (const job of jobs) {
    const existing = counts.get(job.company.id);
    if (existing) {
      existing.openJobCount += 1;
    } else {
      counts.set(job.company.id, { id: job.company.id, slug: job.company.slug, name: job.company.name, openJobCount: 1 });
    }
  }

  return Array.from(counts.values()).slice(0, RELATED_COMPANIES_LIMIT);
}

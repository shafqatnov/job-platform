import type { MetadataRoute } from "next";
import { COUNTRIES } from "@/constants/countries";
import { getPublicJobsForSitemap } from "@/services/jobs/getPublicJobsForSitemap";
import { getPublicCompaniesForSitemap } from "@/services/jobs/getPublicCompaniesForSitemap";
import { OIL_AND_GAS_CATEGORY_SLUGS } from "@/services/jobs/getOilAndGasHub";
import { getSiteOrigin } from "@/lib/siteUrl";

/**
 * Next.js's native sitemap metadata route (app/sitemap.ts) — no new
 * package required, fully supported by the installed Next 16.3.5.
 *
 * Only real, public, indexable routes are included:
 *  - the static marketing/legal pages
 *  - /{country}/jobs for every country in the real COUNTRIES reference
 *    list that currently has at least one publicly visible job — a
 *    country with zero jobs right now is excluded (it also gets a
 *    conditional noindex on the page itself, see
 *    [country]/jobs/page.tsx's own generateMetadata) but stays a
 *    genuinely valid, resolvable, 200-status page; it reappears here
 *    automatically the instant it has a real job, with no manual/
 *    hardcoded list involved. Derived from the SAME job list already
 *    fetched below for the job entries — zero additional queries.
 *  - /{country}/jobs/{slug} for every currently active, public job,
 *    read in a single query (see getPublicJobsForSitemap.ts) — never
 *    one query per country.
 *  - /company/{slug} for every company with at least one currently
 *    active, public job (see getPublicCompaniesForSitemap.ts) — a
 *    company with zero real open jobs has no indexable page today
 *    (getPublicCompanyBySlug.ts returns null for it), so it's never
 *    listed here either.
 *  - /category/{slug} for every real Category (see prisma/schema.prisma)
 *    that currently has at least one publicly visible job — an empty
 *    category is excluded here (and gets its own conditional noindex,
 *    see /category/[slug]/page.tsx's generateMetadata) but stays a
 *    genuinely valid, resolvable, 200-status page; it reappears here the
 *    instant it has a real job. Derived from the SAME job list already
 *    fetched below — zero additional queries, and no separate "list of
 *    all categories" needed at all (unlike countries, which need
 *    COUNTRIES to know every valid slug up front) since a category with
 *    no jobs simply never appears in that job list to begin with.
 *  - /oil-and-gas, only when at least one currently public job is in one
 *    of the explicit Oil & Gas hub categories (see getOilAndGasHub.ts's
 *    own OIL_AND_GAS_CATEGORY_SLUGS) — derived from the SAME job list,
 *    zero additional queries. Excluded when empty, exactly like an empty
 *    category, and reappears automatically the instant it qualifies.
 *
 * Deliberately excluded: /sign-in, /sign-up (utility pages, marked
 * noindex on the page itself), and every /admin, /employer, /candidate,
 * /api route (private surfaces, also disallowed in robots.ts).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteOrigin();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const jobs = await getPublicJobsForSitemap();

  // The same one query's results, reused — never a second query per
  // country and never a hardcoded "known empty" list.
  const countriesWithJobs = new Set(jobs.map((job) => job.countryUrlSlug));
  const countryEntries: MetadataRoute.Sitemap = COUNTRIES.filter((country) =>
    countriesWithJobs.has(country.slug)
  ).map((country) => ({
    url: `${baseUrl}/${country.slug}/jobs`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  const jobEntries: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${baseUrl}/${job.countryUrlSlug}/jobs/${job.slug}`,
    lastModified: job.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Distinct categorySlugs already present in the same job list above —
  // a category with zero public jobs is simply never one of these
  // values, so no separate existence check or full-category-list query
  // is needed.
  const categoriesWithJobs = new Set(jobs.map((job) => job.categorySlug));
  const categoryEntries: MetadataRoute.Sitemap = Array.from(categoriesWithJobs).map((categorySlug) => ({
    url: `${baseUrl}/category/${categorySlug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.6,
  }));

  const companies = await getPublicCompaniesForSitemap();
  const companyEntries: MetadataRoute.Sitemap = companies.map((company) => ({
    url: `${baseUrl}/company/${company.slug}`,
    lastModified: company.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Same job list, checked against the hub's own explicit category
  // scope — no separate query, and no risk of ever double-listing the
  // hub (this is a single boolean-gated push, not a per-category loop).
  const oilAndGasSlugs: readonly string[] = OIL_AND_GAS_CATEGORY_SLUGS;
  const hasOilAndGasJobs = jobs.some((job) => oilAndGasSlugs.includes(job.categorySlug));
  const oilAndGasEntries: MetadataRoute.Sitemap = hasOilAndGasJobs
    ? [{ url: `${baseUrl}/oil-and-gas`, lastModified: now, changeFrequency: "hourly", priority: 0.7 }]
    : [];

  return [
    ...staticEntries,
    ...countryEntries,
    ...jobEntries,
    ...companyEntries,
    ...categoryEntries,
    ...oilAndGasEntries,
  ];
}

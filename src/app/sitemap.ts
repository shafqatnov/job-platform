import type { MetadataRoute } from "next";
import { COUNTRIES } from "@/constants/countries";
import { getPublicJobsForSitemap } from "@/services/jobs/getPublicJobsForSitemap";
import { getPublicCompaniesForSitemap } from "@/services/jobs/getPublicCompaniesForSitemap";
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

  const companies = await getPublicCompaniesForSitemap();
  const companyEntries: MetadataRoute.Sitemap = companies.map((company) => ({
    url: `${baseUrl}/company/${company.slug}`,
    lastModified: company.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...countryEntries, ...jobEntries, ...companyEntries];
}

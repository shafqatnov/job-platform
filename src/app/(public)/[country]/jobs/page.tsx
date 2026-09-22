import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountryBySlug } from "@/constants/countries";
import { JobsListingView } from "@/features/jobs/JobsListingView";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import {
  countPublicJobs,
  hasPublicJobsInCountry,
  normalizePublicJobsPage,
  PUBLIC_JOBS_PAGE_SIZE,
} from "@/services/jobs/getPublicJobs";

/** A searchParams entry can arrive as a string, an array (repeated key), or absent. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses a raw searchParams "page" value into a number for normalizePublicJobsPage — undefined stays undefined (defaults to page 1); anything else (including non-numeric text) is passed through as-is and safely normalized there, never guessed at here. */
function parsePage(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[country]/jobs"> & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = getCountryBySlug(countrySlug);

  // Not calling notFound() here: metadata generation runs in a separate
  // phase from rendering the page, and doing so did not resolve to this
  // segment's not-found.tsx in testing. The page component below is the
  // single source of truth for the 404 decision.
  if (!country) {
    return { title: "Jobs" };
  }

  const title = `Jobs in ${country.name}`;
  const description = `Browse open roles in ${country.name} across multiple industries. Filter by category, location, and work type to find your next opportunity.`;
  const siteUrl = getConfiguredSiteUrl();
  // Only ever built from a country slug that has already resolved to a
  // real, known country above — never an invalid/guessed one.
  const path = `/${country.slug}/jobs`;

  const query = await searchParams;
  const page = normalizePublicJobsPage(parsePage(firstValue(query.page)));
  // Page 1's URL is exactly the bare /{country}/jobs path, unchanged
  // from before pagination existed; page 2+ gets its own
  // self-referencing canonical, never consolidated back to page 1 (see
  // /jobs/page.tsx's identical policy). Filters (?q=/?category=) are
  // deliberately still ignored here, matching this page's own
  // pre-existing (pre-pagination) canonical policy — only the page
  // number is new.
  const pageUrl = page > 1 ? `${path}?page=${page}` : path;

  // Evaluated fresh from the real current public-job count on every
  // request (never a hardcoded/cached list of "known empty" countries
  // or pages) — see hasPublicJobsInCountry's own doc comment. Page 1
  // reuses that same existing, cheaper existence check (findFirst,
  // stops at the first match) exactly as before pagination existed;
  // page 2+ needs the real count to know whether THIS specific page has
  // any results at all (e.g. ?page=9999 on a country with only 10 real
  // jobs) — a page beyond the last one with real results is excluded
  // from search results rather than creating an indexable, permanently-
  // empty duplicate URL, and automatically included again the moment it
  // has something worth showing.
  const hasResultsOnThisPage =
    page <= 1
      ? await hasPublicJobsInCountry(country.slug)
      : (page - 1) * PUBLIC_JOBS_PAGE_SIZE < (await countPublicJobs({ countryUrlSlug: country.slug }));

  return {
    title,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${pageUrl}` } } : {}),
    ...(hasResultsOnThisPage ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${pageUrl}` } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CountryJobsPage({
  params,
  searchParams,
}: PageProps<"/[country]/jobs"> & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { country: countrySlug } = await params;
  const country = getCountryBySlug(countrySlug);

  if (!country) {
    notFound();
  }

  const query = await searchParams;

  return (
    <JobsListingView
      country={country}
      filters={{
        keywords: firstValue(query.q),
        categorySlug: firstValue(query.category),
        workMode: firstValue(query.workMode),
        employmentType: firstValue(query.employmentType),
        page: parsePage(firstValue(query.page)),
      }}
    />
  );
}

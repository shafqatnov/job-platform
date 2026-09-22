import type { Metadata } from "next";
import { JobsListingView } from "@/features/jobs/JobsListingView";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { countPublicJobs, normalizePublicJobsPage, PUBLIC_JOBS_PAGE_SIZE } from "@/services/jobs/getPublicJobs";

const TITLE = "Browse All Jobs";
const DESCRIPTION =
  "Browse open roles across multiple countries and industries. Filter by category, location, and work type to find your next opportunity.";
const path = "/jobs";

/** A searchParams entry can arrive as a string, an array (repeated key), or absent. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses a raw searchParams "page" value into a number for normalizePublicJobsPage — undefined stays undefined (defaults to page 1); anything else (including non-numeric text) is passed through as-is and safely normalized there, never guessed at here. */
function parsePage(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = normalizePublicJobsPage(parsePage(firstValue(params.page)));
  const siteUrl = getConfiguredSiteUrl();
  // Page 1's URL is exactly the bare /jobs path, unchanged from before
  // pagination existed; page 2+ gets its own self-referencing canonical
  // (current pages are not consolidated back to page 1 — see
  // [country]/jobs/page.tsx's identical policy). Filters (?q=/?country=/
  // ?category=) are deliberately still ignored here, matching this
  // page's own pre-existing (pre-pagination) canonical policy — only
  // the page number is new.
  const pageUrl = page > 1 ? `${path}?page=${page}` : path;

  // Same "is this specific page empty" rule as [country]/jobs/page.tsx —
  // never a hardcoded/cached answer, re-evaluated every request from the
  // real current count. A page beyond the last one with real results
  // (e.g. ?page=9999) is excluded from search results rather than
  // creating an indexable, permanently-empty duplicate URL; the first
  // page automatically stays indexable as long as the platform has at
  // least one public job.
  const totalCount = await countPublicJobs({});
  const hasResultsOnThisPage = (page - 1) * PUBLIC_JOBS_PAGE_SIZE < totalCount;

  return {
    title: TITLE,
    description: DESCRIPTION,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${pageUrl}` } } : {}),
    ...(hasResultsOnThisPage ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${pageUrl}` } : {}),
    },
    twitter: {
      card: "summary",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <JobsListingView
      filters={{
        keywords: firstValue(params.q),
        countryCode: firstValue(params.country),
        categorySlug: firstValue(params.category),
        workMode: firstValue(params.workMode),
        employmentType: firstValue(params.employmentType),
        page: parsePage(firstValue(params.page)),
      }}
    />
  );
}

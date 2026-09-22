import Link from "next/link";
import { Section } from "@/components/Section";
import { AdSlot } from "@/components/AdSlot";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { getButtonClassName } from "@/components/Button";
import { JobFiltersBar } from "@/features/jobs/JobFiltersBar";
import { JobCard } from "@/features/jobs/JobCard";
import type { SaveState } from "@/features/jobs/SaveJobButton";
import { SORT_OPTIONS } from "@/features/jobs/constants";
import { getPublicJobs, countPublicJobs, normalizePublicJobsPage, getPublicJobsPaginationInfo } from "@/services/jobs/getPublicJobs";
import { getCountryByCode, type CountryOption } from "@/constants/countries";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { getSavedJobIdSet } from "@/services/candidates/getSavedJobs";

const CREATE_PROFILE_HREF = "/candidate/profile/create";

export type JobListingFilters = {
  /** Raw keyword query (searchParams "q") — matched against title/description. */
  keywords?: string;
  /** Raw country CODE (searchParams "country", e.g. "gb") from the unscoped /jobs
   *  filter bar — resolved to a real Country by src/constants/countries.ts. Ignored
   *  when `country` (the route-scoped country) is already set. */
  countryCode?: string;
  /** Raw category slug (searchParams "category"). */
  categorySlug?: string;
  /**
   * Raw Work Mode / Employment Type values (searchParams "workMode" /
   * "employmentType"). Not applied as real filters — there is still no
   * workMode/employmentType column on Job (see getPublicJobs.ts's own
   * doc comment) — carried through only so a visitor's selection isn't
   * silently dropped from the URL when moving between pagination pages.
   */
  workMode?: string;
  employmentType?: string;
  /** Raw 1-based page number (searchParams "page"), not yet sanitized — normalizePublicJobsPage handles 0/negative/non-numeric/absent. */
  page?: number;
};

export type JobsListingViewProps = {
  /** Present only on the country-scoped route; absent on the global /jobs page. */
  country?: CountryOption;
  /** Parsed from the current page's searchParams — see both jobs page.tsx files. */
  filters?: JobListingFilters;
};

/**
 * Builds the URL for a given target page, preserving every currently
 * supported query parameter (country query param only applies to the
 * unscoped /jobs route — the country-scoped route carries its country
 * in the URL segment instead, never as a query param) except `page`
 * itself, which is set to the target page (page 1 omits it entirely, so
 * the first page's URL stays exactly what it already was before
 * pagination existed).
 */
function buildPageHref(basePath: string, filters: JobListingFilters | undefined, isCountryScoped: boolean, targetPage: number): string {
  const params = new URLSearchParams();
  if (!isCountryScoped && filters?.countryCode) params.set("country", filters.countryCode);
  if (filters?.categorySlug) params.set("category", filters.categorySlug);
  if (filters?.keywords) params.set("q", filters.keywords);
  if (filters?.workMode) params.set("workMode", filters.workMode);
  if (filters?.employmentType) params.set("employmentType", filters.employmentType);
  if (targetPage > 1) params.set("page", String(targetPage));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Shared presentation for both /jobs and /{country}/jobs. Reads
 * currently-publishable jobs through the jobs service (never Prisma
 * directly — see src/services/jobs/getPublicJobs.ts). If the query
 * genuinely fails, that error is allowed to propagate to the (public)
 * route group's error boundary rather than being caught here and shown
 * as an empty result, which would misrepresent a system failure as
 * "no jobs yet."
 */
export async function JobsListingView({ country, filters }: JobsListingViewProps) {
  // The route-scoped country (set only on /{country}/jobs) always wins
  // over a stray "country" query value — the filter bar's country field
  // is disabled on that route for exactly this reason, so in practice
  // filters?.countryCode is never set there anyway.
  const resolvedCountry = country ?? (filters?.countryCode ? getCountryByCode(filters.countryCode) : undefined);
  const basePath = country ? `/${country.slug}/jobs` : "/jobs";

  const page = normalizePublicJobsPage(filters?.page);
  const listingFilters = {
    countryUrlSlug: resolvedCountry?.slug,
    categorySlug: filters?.categorySlug,
    keywords: filters?.keywords,
  };

  const [jobs, totalCount] = await Promise.all([
    getPublicJobs({ ...listingFilters, page }),
    countPublicJobs(listingFilters),
  ]);
  const { totalPages, hasPreviousPage, hasNextPage } = getPublicJobsPaginationInfo(page, totalCount);
  // Jobs genuinely exist for this filter combination, but the requested
  // page is past the last one that has any (e.g. ?page=9999) — a
  // different, more useful message than "no jobs yet at all".
  const isPageBeyondResults = totalCount > 0 && jobs.length === 0;

  // Save-button state for every card on this page, computed once (not
  // per card) to avoid an N+1 query: a single batched lookup of which
  // of these job IDs the viewer has already saved, per
  // getSavedJobIdSet's own doc comment.
  const user = await getSessionUser();
  const candidateProfile = user && user.role === "candidate" ? await getCandidateProfile(user.id) : null;
  const savedJobIds = candidateProfile
    ? await getSavedJobIdSet(candidateProfile.id, jobs.map((job) => job.id))
    : new Set<string>();

  function saveStateFor(jobId: string): SaveState {
    if (!user) return "signed_out";
    if (user.role !== "candidate") return "not_candidate";
    if (!candidateProfile) return "no_profile";
    return savedJobIds.has(jobId) ? "saved" : "unsaved";
  }

  const heading = country ? `Jobs in ${country.name}` : "Browse All Jobs";
  const intro = country
    ? `Open roles in ${country.name}, across multiple industries and companies.`
    : "Open roles across multiple countries and industries.";

  return (
    <Section aria-labelledby="jobs-listing-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="jobs-listing-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          {heading}
        </h1>
        <p className="text-muted-foreground">{intro}</p>
      </div>

      <JobFiltersBar
        lockedCountry={country}
        defaultKeywords={filters?.keywords}
        defaultCategorySlug={filters?.categorySlug}
      />

      <div className="my-6 flex justify-center">
        <AdSlot size="leaderboard" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {totalCount} {totalCount === 1 ? "job" : "jobs"} found
          </p>
          <Select
            label="Sort by"
            name="sort"
            hideLabel
            defaultValue="relevance"
            options={SORT_OPTIONS}
            className="w-auto"
          />
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title={
              isPageBeyondResults
                ? "No more jobs on this page"
                : country
                  ? `No jobs published in ${country.name} yet`
                  : "No jobs published yet"
            }
            description={
              isPageBeyondResults
                ? "You've gone past the last page of results."
                : "New listings will appear here as soon as employers start posting. Check back soon, or be the first to post a role."
            }
            action={
              isPageBeyondResults ? (
                <Link
                  href={buildPageHref(basePath, filters, Boolean(country), 1)}
                  className={getButtonClassName({ variant: "outline", size: "sm" })}
                >
                  Back to page 1
                </Link>
              ) : (
                <Link href="/employer" className={getButtonClassName({ variant: "outline", size: "sm" })}>
                  Post a job
                </Link>
              )
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} saveState={saveStateFor(job.id)} createProfileHref={CREATE_PROFILE_HREF} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            previousHref={hasPreviousPage ? buildPageHref(basePath, filters, Boolean(country), page - 1) : undefined}
            nextHref={hasNextPage ? buildPageHref(basePath, filters, Boolean(country), page + 1) : undefined}
          />
        ) : null}
      </div>
    </Section>
  );
}

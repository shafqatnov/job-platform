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
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
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
};

export type JobsListingViewProps = {
  /** Present only on the country-scoped route; absent on the global /jobs page. */
  country?: CountryOption;
  /** Parsed from the current page's searchParams — see both jobs page.tsx files. */
  filters?: JobListingFilters;
};

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

  const jobs = await getPublicJobs({
    countryUrlSlug: resolvedCountry?.slug,
    categorySlug: filters?.categorySlug,
    keywords: filters?.keywords,
  });

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
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} found
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
            title={country ? `No jobs published in ${country.name} yet` : "No jobs published yet"}
            description="New listings will appear here as soon as employers start posting. Check back soon, or be the first to post a role."
            action={
              <Link href="/employer" className={getButtonClassName({ variant: "outline", size: "sm" })}>
                Post a job
              </Link>
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

        <Pagination currentPage={1} totalPages={1} />
      </div>
    </Section>
  );
}

import Link from "next/link";
import { Section } from "@/components/Section";
import { AdSlot } from "@/components/AdSlot";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { getButtonClassName } from "@/components/Button";
import { JobFiltersBar } from "@/features/jobs/JobFiltersBar";
import { JobCard } from "@/features/jobs/JobCard";
import { SORT_OPTIONS } from "@/features/jobs/constants";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import type { CountryOption } from "@/constants/countries";

export type JobsListingViewProps = {
  /** Present only on the country-scoped route; absent on the global /jobs page. */
  country?: CountryOption;
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
export async function JobsListingView({ country }: JobsListingViewProps) {
  const jobs = await getPublicJobs({ countryUrlSlug: country?.slug });

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

      <JobFiltersBar lockedCountry={country} />

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
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}

        <Pagination currentPage={1} totalPages={1} />
      </div>
    </Section>
  );
}

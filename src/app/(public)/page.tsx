import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { AdSlot } from "@/components/AdSlot";
import { JobSearchForm } from "@/features/jobs/JobSearchForm";
import { FeaturedJobsSection } from "@/features/jobs/FeaturedJobsSection";
import { LatestJobsSection } from "@/features/jobs/LatestJobsSection";
import { PopularCategories } from "@/features/jobs/PopularCategories";
import { PopularCountries } from "@/features/jobs/PopularCountries";
import { EmployerCta } from "@/features/employers/EmployerCta";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";

export const metadata: Metadata = {
  title: "Find Jobs Worldwide",
  description:
    "Search jobs across multiple countries and industries, and apply directly with verified employers on a global job search platform built for candidates and employers.",
};

export default async function HomePage() {
  // Fetched once here (not inside each section) so both Featured and
  // Latest read from a single real query — see getPublicJobs.ts, the
  // one place allowed to query Job for public visibility.
  const jobs = await getPublicJobs();

  return (
    <>
      <Section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-xl -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-0 h-64 w-64 rounded-full bg-accent-200/30 blur-3xl dark:bg-accent-500/10"
        />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            Global Job Search
          </span>
          <h1
            id="hero-heading"
            className="text-display-sm font-semibold tracking-tight text-foreground sm:text-display-md lg:text-display-lg"
          >
            Find your next role,{" "}
            <span className="bg-linear-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
              anywhere in the world
            </span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Search real, employer-posted roles across multiple countries and industries — no
            recycled listings, no noise.
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-10 max-w-4xl">
          <JobSearchForm />
        </div>
      </Section>

      <Container className="flex justify-center py-6">
        <AdSlot size="leaderboard" />
      </Container>

      <FeaturedJobsSection jobs={jobs} />
      <LatestJobsSection jobs={jobs} />
      <PopularCategories />
      <PopularCountries />

      <Container className="flex justify-center py-6">
        <AdSlot size="rectangle" />
      </Container>

      <EmployerCta />
    </>
  );
}

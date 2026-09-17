import Link from "next/link";
import { Section } from "@/components/Section";
import { EmptyState } from "@/components/EmptyState";
import { JobCard } from "@/features/jobs/JobCard";
import type { JobListItem } from "@/features/jobs/types";

export type FeaturedJobsSectionProps = {
  jobs: JobListItem[];
};

/**
 * There is no "featured" flag on Job (see prisma/schema.prisma) — Phase 1
 * has no promotion/curation mechanism, and inventing one is out of
 * scope. This section shows the most recently approved real jobs
 * instead of a fabricated curated set; the copy below is worded to
 * match that (no false "hand-picked" claim).
 */
export function FeaturedJobsSection({ jobs }: FeaturedJobsSectionProps) {
  const featured = jobs.slice(0, 3);

  return (
    <Section aria-labelledby="featured-jobs-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="featured-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Featured Jobs
        </h2>
        <p className="text-muted-foreground">Recently approved roles from verified employers.</p>
      </div>
      {featured.length === 0 ? (
        <EmptyState
          title="Featured jobs are coming soon"
          description="Employers haven't published listings yet. Check back shortly, or explore the full job search in the meantime."
          action={
            <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Browse all jobs →
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {featured.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

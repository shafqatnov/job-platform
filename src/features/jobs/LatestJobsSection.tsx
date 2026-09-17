import { Section } from "@/components/Section";
import { EmptyState } from "@/components/EmptyState";
import { JobCard } from "@/features/jobs/JobCard";
import type { JobListItem } from "@/features/jobs/types";

export type LatestJobsSectionProps = {
  jobs: JobListItem[];
};

export function LatestJobsSection({ jobs }: LatestJobsSectionProps) {
  const latest = jobs.slice(0, 6);

  return (
    <Section aria-labelledby="latest-jobs-heading" className="bg-surface-muted">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="latest-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Latest Jobs
        </h2>
        <p className="text-muted-foreground">The newest roles as employers publish them.</p>
      </div>
      {latest.length === 0 ? (
        <EmptyState
          title="No jobs published yet"
          description="This is where the newest listings will appear the moment employers start posting — check back soon."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {latest.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

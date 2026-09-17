import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { JobListItem } from "@/features/jobs/types";

export type JobCardProps = {
  job: JobListItem;
};

/**
 * Presentational job summary card, shaped around the future Job schema
 * (see docs/26-database-schema-design.md). Never rendered with invented
 * data — the listing view only maps over real job records once a jobs
 * service exists; until then this component's map() call has nothing to
 * iterate over.
 */
export function JobCard({ job }: JobCardProps) {
  const location = [job.city, job.countryName].filter(Boolean).join(", ");
  const salary =
    job.salaryMin !== undefined && job.salaryMax !== undefined && job.currencyCode
      ? `${job.currencyCode} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`
      : undefined;

  return (
    <Card padding="md" className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Link
          href={`/${job.countrySlug}/jobs/${job.slug}`}
          className="text-base font-semibold text-foreground hover:text-brand-700"
        >
          {job.title}
        </Link>
        <p className="text-sm text-muted-foreground">{job.companyName}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{location}</Badge>
        <Badge variant="neutral">{job.employmentType}</Badge>
        {job.workMode ? <Badge variant="brand">{job.workMode}</Badge> : null}
      </div>
      {salary ? <p className="text-sm font-medium text-foreground">{salary}</p> : null}
    </Card>
  );
}

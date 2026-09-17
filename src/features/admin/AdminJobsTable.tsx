import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";
import { JOB_STATUS_LABELS, JOB_STATUS_VARIANTS } from "@/constants/jobStatus";
import type { AdminJobRow } from "@/services/admin/listAdminJobs";

export type AdminJobsTableProps = {
  jobs: AdminJobRow[];
  emptyTitle: string;
  emptyDescription?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Shared list rendering for every admin job surface (/admin/jobs and
 * /admin/jobs/pending) — one place for the row layout so the two pages
 * can't drift into showing different fields for the same data.
 */
export function AdminJobsTable({ jobs, emptyTitle, emptyDescription }: AdminJobsTableProps) {
  if (jobs.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {jobs.map((job) => (
        <li key={job.id} className="py-4 first:pt-0 last:pb-0">
          <Link
            href={`/admin/jobs/${job.id}`}
            className="flex flex-col gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">{job.title}</span>
              <span className="text-sm text-muted-foreground">
                {job.companyName} &middot; {job.cityName}, {job.countryName} &middot; {job.categoryName}
              </span>
              <span className="text-sm text-muted-foreground">
                {job.employerName} ({job.employerEmail}) &middot; {dateFormatter.format(new Date(job.createdAt))}
              </span>
            </div>
            <Badge variant={JOB_STATUS_VARIANTS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

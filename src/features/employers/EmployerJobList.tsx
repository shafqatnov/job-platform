import Link from "next/link";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { JOB_STATUS_LABELS, JOB_STATUS_VARIANTS } from "@/constants/jobStatus";
import type { EmployerJobRow } from "@/services/jobs/getEmployerJobs";

export type EmployerJobListProps = {
  jobs: EmployerJobRow[];
  emptyTitle: string;
  emptyDescription: string;
  /** Shows the real savedJobCount alongside applicationCount — used by the Job Performance page; the dashboard/Active/Pending pages keep their existing, simpler row without it. */
  showSavedCount?: boolean;
};

/**
 * The employer job-list row markup, extracted verbatim from the
 * existing employer dashboard (src/app/(dashboard)/employer/page.tsx)
 * so Employer Portal 2.0's new Active Jobs / Pending Jobs / Job
 * Performance pages render jobs identically to the dashboard they
 * already know, rather than a second, subtly-different list design.
 */
export function EmployerJobList({ jobs, emptyTitle, emptyDescription, showSavedCount }: EmployerJobListProps) {
  if (jobs.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {jobs.map((job) => (
        <li key={job.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-foreground">{job.title}</span>
            <Badge variant={JOB_STATUS_VARIANTS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </div>
          {job.status === "rejected" && job.rejectionReason ? (
            <p className="text-sm text-muted-foreground">Reason: {job.rejectionReason}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href={`/employer/jobs/${job.id}/applications`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {job.applicationCount} {job.applicationCount === 1 ? "application" : "applications"}
            </Link>
            {showSavedCount ? (
              <span className="text-sm text-muted-foreground">
                {job.savedJobCount} {job.savedJobCount === 1 ? "candidate has" : "candidates have"} saved this job
              </span>
            ) : null}
            <Link href={`/employer/jobs/${job.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Manage
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

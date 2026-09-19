import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";
import { JOB_STATUS_LABELS, JOB_STATUS_VARIANTS } from "@/constants/jobStatus";

export const metadata: Metadata = {
  title: "Employer Dashboard",
  robots: { index: false, follow: false },
};

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The layout above already guarantees a valid, active employer
  // session; `user` is only possibly null here to satisfy TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  const jobs = employerCompany ? await getEmployerJobs(employerCompany.companyId) : [];
  const justPosted = (await searchParams).posted === "1";

  const postJobHref = employerCompany ? "/employer/jobs/new" : "/employer/company/new";

  return (
    <Section aria-labelledby="employer-dashboard-heading">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="employer-dashboard-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Employer Dashboard
          </h1>
          {user ? <p className="text-muted-foreground">Signed in as {user.email}</p> : null}
        </div>
        <Link href={postJobHref} className={getButtonClassName({ size: "lg" })}>
          Post a Job
        </Link>
      </div>

      {justPosted ? (
        <p role="status" className="mb-6 rounded-md border border-brand-600 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          Your job was submitted and is now pending review.
        </p>
      ) : null}

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Your job listings</h2>
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs posted yet"
            description="Once you publish your first listing, it will appear here for you to manage."
          />
        ) : (
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
                  <Link
                    href={`/employer/jobs/${job.id}/applications`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {job.applicationCount} {job.applicationCount === 1 ? "application" : "applications"}
                  </Link>
                  <Link
                    href={`/employer/jobs/${job.id}`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

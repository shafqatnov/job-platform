import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getButtonClassName } from "@/components/Button";
import { EmployerJobList } from "@/features/employers/EmployerJobList";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";

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

  // All derived from the same single jobs read above — no additional
  // queries — exactly the real, current counts by status.
  const activeCount = jobs.filter((job) => job.status === "active").length;
  const pendingCount = jobs.filter((job) => job.status === "pending_review").length;
  const totalApplications = jobs.reduce((sum, job) => sum + job.applicationCount, 0);

  return (
    <Section aria-labelledby="employer-dashboard-heading">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="employer-dashboard-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Employer Dashboard
          </h1>
          {user ? <p className="text-muted-foreground">Signed in as {user.email}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {employerCompany ? (
            <Link href="/employer/company/edit" className={getButtonClassName({ size: "lg", variant: "outline" })}>
              Edit Company
            </Link>
          ) : null}
          <Link href={postJobHref} className={getButtonClassName({ size: "lg" })}>
            Post a Job
          </Link>
        </div>
      </div>

      {justPosted ? (
        <p role="status" className="mb-6 rounded-md border border-brand-600 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          Your job was submitted and is now pending review.
        </p>
      ) : null}

      {employerCompany ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/employer/jobs/active" className="block">
            <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
              <p className="text-sm text-muted-foreground">Active jobs</p>
              <p className="text-2xl font-semibold text-foreground">{activeCount}</p>
            </Card>
          </Link>
          <Link href="/employer/jobs/pending" className="block">
            <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
              <p className="text-sm text-muted-foreground">Pending review</p>
              <p className="text-2xl font-semibold text-foreground">{pendingCount}</p>
            </Card>
          </Link>
          <Link href="/employer/applications" className="block">
            <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
              <p className="text-sm text-muted-foreground">Total applications</p>
              <p className="text-2xl font-semibold text-foreground">{totalApplications}</p>
            </Card>
          </Link>
          <Link href="/employer/analytics" className="block">
            <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
              <p className="text-sm text-muted-foreground">Analytics</p>
              <p className="text-2xl font-semibold text-foreground">View</p>
            </Card>
          </Link>
        </div>
      ) : null}

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Your job listings</h2>
        <EmployerJobList
          jobs={jobs}
          emptyTitle="No jobs posted yet"
          emptyDescription="Once you publish your first listing, it will appear here for you to manage."
        />
      </Card>
    </Section>
  );
}

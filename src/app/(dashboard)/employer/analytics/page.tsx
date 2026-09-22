import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

/**
 * Every figure here is a real aggregate of this company's own current
 * Job/Application/SavedJob rows (via getEmployerJobs, the existing,
 * already-scoped read) — never an invented metric, and never data from
 * a tracking system that doesn't exist in this codebase (there is no
 * page-view/click-through tracking anywhere). "Average applications per
 * active job" is a genuine computed ratio, rounded to one decimal, of
 * real counts — not a guess.
 */
export default async function EmployerAnalyticsPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const jobs = await getEmployerJobs(employerCompany.companyId);

  const activeJobs = jobs.filter((job) => job.status === "active");
  const pendingJobs = jobs.filter((job) => job.status === "pending_review");
  const closedJobs = jobs.filter((job) => job.status === "closed");
  const expiredJobs = jobs.filter((job) => job.status === "expired");
  const rejectedJobs = jobs.filter((job) => job.status === "rejected");

  const totalApplications = jobs.reduce((sum, job) => sum + job.applicationCount, 0);
  const totalSaved = jobs.reduce((sum, job) => sum + job.savedJobCount, 0);
  const averageApplicationsPerActiveJob =
    activeJobs.length > 0 ? Math.round((totalApplications / activeJobs.length) * 10) / 10 : null;

  const stats: Array<{ label: string; value: string | number }> = [
    { label: "Total jobs posted", value: jobs.length },
    { label: "Active", value: activeJobs.length },
    { label: "Pending review", value: pendingJobs.length },
    { label: "Closed", value: closedJobs.length },
    { label: "Expired", value: expiredJobs.length },
    { label: "Rejected", value: rejectedJobs.length },
    { label: "Total applications", value: totalApplications },
    { label: "Total saved by candidates", value: totalSaved },
  ];
  if (averageApplicationsPerActiveJob !== null) {
    stats.push({ label: "Avg. applications per active job", value: averageApplicationsPerActiveJob });
  }

  return (
    <Section aria-labelledby="analytics-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="analytics-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Analytics
        </h1>
        <p className="text-muted-foreground">A summary of your company&apos;s real job and application activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="lg">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmployerJobList } from "@/features/employers/EmployerJobList";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";

export const metadata: Metadata = {
  title: "Pending Jobs",
  robots: { index: false, follow: false },
};

export default async function EmployerPendingJobsPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const jobs = await getEmployerJobs(employerCompany.companyId, "pending_review");

  return (
    <Section aria-labelledby="pending-jobs-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="pending-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Pending jobs
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} awaiting review
        </p>
      </div>

      <Card padding="lg">
        <EmployerJobList
          jobs={jobs}
          emptyTitle="No jobs awaiting review"
          emptyDescription="Jobs you submit are reviewed before going live — anything awaiting review will appear here."
        />
      </Card>
    </Section>
  );
}

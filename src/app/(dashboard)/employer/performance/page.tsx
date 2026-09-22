import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmployerJobList } from "@/features/employers/EmployerJobList";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";

export const metadata: Metadata = {
  title: "Job Performance",
  robots: { index: false, follow: false },
};

/**
 * Per-job performance — the same real applicationCount/savedJobCount
 * getEmployerJobs.ts already computes, just sorted by applicationCount
 * (a genuine, real ordering, not an invented "performance score") so
 * the most-applied-to jobs surface first.
 */
export default async function EmployerPerformancePage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const jobs = await getEmployerJobs(employerCompany.companyId);
  const sortedJobs = [...jobs].sort((a, b) => b.applicationCount - a.applicationCount);

  return (
    <Section aria-labelledby="performance-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="performance-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Job performance
        </h1>
        <p className="text-muted-foreground">Applications and saves per job, most-applied-to first.</p>
      </div>

      <Card padding="lg">
        <EmployerJobList
          jobs={sortedJobs}
          emptyTitle="No jobs posted yet"
          emptyDescription="Once you publish a listing, its applications and saves will appear here."
          showSavedCount
        />
      </Card>
    </Section>
  );
}

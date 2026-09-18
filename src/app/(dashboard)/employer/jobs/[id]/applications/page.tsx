import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobDetail } from "@/services/jobs/getEmployerJobDetail";
import { getApplicationsForJob } from "@/services/applications/getApplicationsForJob";
import { APPLICATION_STATUS_LABELS } from "@/constants/applicationStatus";

export const metadata: Metadata = {
  title: "Job Applications",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function EmployerJobApplicationsPage({ params }: PageProps<"/employer/jobs/[id]/applications">) {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const { id } = await params;
  // Ownership is enforced inside the query itself (job.companyId must
  // match) — a job belonging to a different company is indistinguishable
  // from a non-existent one here.
  const job = await getEmployerJobDetail(id, employerCompany.companyId);
  if (!job) {
    notFound();
  }

  const applications = await getApplicationsForJob(job.id);

  return (
    <Section aria-labelledby="job-applications-heading">
      <h1 id="job-applications-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Applications for {job.title}
      </h1>
      <p className="mb-8 text-muted-foreground">
        {applications.length} {applications.length === 1 ? "application" : "applications"}
      </p>

      <Card padding="lg">
        {applications.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Applications from candidates will appear here as soon as they apply."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-foreground">{application.candidateName}</span>
                <span className="text-sm text-muted-foreground">
                  Applied {dateFormatter.format(new Date(application.appliedDate))}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {APPLICATION_STATUS_LABELS[application.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getApplicationsForCompany } from "@/services/applications/getApplicationsForCompany";
import { APPLICATION_STATUS_LABELS } from "@/constants/applicationStatus";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Employer Portal 2.0's company-wide applications view — every
 * application across every job this company has posted, in one place.
 * The existing per-job applications page
 * (/employer/jobs/[id]/applications) is untouched; this is an
 * additional, broader view built on a new service
 * (getApplicationsForCompany.ts) that reuses the exact same Application
 * model and privacy boundary.
 */
export default async function EmployerApplicationsPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const applications = await getApplicationsForCompany(employerCompany.companyId);

  return (
    <Section aria-labelledby="applications-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="applications-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Applications
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {applications.length} {applications.length === 1 ? "application" : "applications"} across all jobs
        </p>
      </div>

      <Card padding="lg">
        {applications.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Applications from candidates across all your jobs will appear here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {applications.map((application) => {
              const location = [application.candidateCityName, application.candidateCountryName]
                .filter(Boolean)
                .join(", ");

              return (
                <li key={application.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-foreground">{application.candidateName}</span>
                    <span className="text-sm font-medium text-foreground">
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </div>
                  <Link
                    href={`/employer/jobs/${application.jobId}/applications`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {application.jobTitle}
                  </Link>
                  {application.candidateHeadline ? (
                    <p className="text-sm text-muted-foreground">{application.candidateHeadline}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    {location ? <span>{location}</span> : null}
                    <span>Applied {dateFormatter.format(new Date(application.appliedDate))}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Section>
  );
}

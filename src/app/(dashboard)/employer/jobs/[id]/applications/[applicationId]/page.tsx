import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobDetail } from "@/services/jobs/getEmployerJobDetail";
import { getApplicationForEmployer } from "@/services/applications/getApplicationForEmployer";
import { APPLICATION_STATUS_LABELS } from "@/constants/applicationStatus";

export const metadata: Metadata = {
  title: "Application Detail",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function EmployerApplicationDetailPage({
  params,
}: PageProps<"/employer/jobs/[id]/applications/[applicationId]">) {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const { id, applicationId } = await params;
  // Ownership is enforced inside the query itself (job.companyId must
  // match) — a job belonging to a different company is indistinguishable
  // from a non-existent one here, exactly like the applications list page.
  const job = await getEmployerJobDetail(id, employerCompany.companyId);
  if (!job) {
    notFound();
  }

  // Scoped by BOTH applicationId and this already-ownership-verified
  // job.id — an application id belonging to a different job (even one
  // under this same company) cannot match, so a 404 here never reveals
  // whether that other application exists at all.
  const application = await getApplicationForEmployer(applicationId, job.id);
  if (!application) {
    notFound();
  }

  const location = [application.candidateCityName, application.candidateCountryName].filter(Boolean).join(", ");

  return (
    <Section aria-labelledby="application-detail-heading" containerClassName="max-w-2xl">
      <Link
        href={`/employer/jobs/${job.id}/applications`}
        className="mb-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Back to applications
      </Link>

      <h1 id="application-detail-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Application for {job.title}
      </h1>

      <Card padding="lg" className="mb-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Candidate</h2>
        <p className="font-medium text-foreground">{application.candidateName}</p>
        {application.candidateHeadline ? (
          <p className="text-sm text-muted-foreground">{application.candidateHeadline}</p>
        ) : null}
        {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
      </Card>

      <Card padding="lg" className="mb-6 flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Application</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Applied</dt>
            <dd className="text-foreground">{dateFormatter.format(new Date(application.appliedDate))}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="text-foreground">{APPLICATION_STATUS_LABELS[application.status]}</dd>
          </div>
        </dl>
      </Card>

      {application.coverNote ? (
        <Card padding="lg">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Cover note</h2>
          <p className="whitespace-pre-wrap text-foreground">{application.coverNote}</p>
        </Card>
      ) : null}
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobForManage } from "@/services/jobs/getEmployerJobForManage";
import { JobLifecycleActions } from "@/features/jobs/JobLifecycleActions";
import { JOB_STATUS_LABELS, JOB_STATUS_VARIANTS } from "@/constants/jobStatus";

export const metadata: Metadata = {
  title: "Manage Job",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function EmployerJobManagePage({ params }: PageProps<"/employer/jobs/[id]">) {
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
  // from a non-existent one here, exactly like the applications page.
  const job = await getEmployerJobForManage(id, employerCompany.companyId);
  if (!job) {
    notFound();
  }

  return (
    <Section aria-labelledby="manage-job-heading" containerClassName="max-w-2xl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 id="manage-job-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          {job.title}
        </h1>
        <Badge variant={JOB_STATUS_VARIANTS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </div>

      <Card padding="lg" className="mb-6 flex flex-col gap-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Applications</dt>
            <dd className="text-foreground">{job.applicationCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Saved by candidates</dt>
            <dd className="text-foreground">{job.savedJobCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Expiry</dt>
            <dd className="text-foreground">
              {job.expiresAt ? dateFormatter.format(new Date(job.expiresAt)) : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Closed at</dt>
            <dd className="text-foreground">
              {job.closedAt ? dateFormatter.format(new Date(job.closedAt)) : "—"}
            </dd>
          </div>
        </dl>
        <Link
          href={`/employer/jobs/${job.id}/applications`}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View applications
        </Link>
      </Card>

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Manage listing</h2>
        <JobLifecycleActions
          jobId={job.id}
          jobTitle={job.title}
          companyName={job.companyName}
          status={job.status}
          canDelete={job.applicationCount === 0 && job.savedJobCount === 0}
        />
      </Card>
    </Section>
  );
}

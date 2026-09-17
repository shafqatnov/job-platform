import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { JobReviewActions } from "@/features/admin/JobReviewActions";
import { getJobForAdmin } from "@/services/admin/getJobForAdmin";
import { JOB_STATUS_LABELS, JOB_STATUS_VARIANTS } from "@/constants/jobStatus";

export const metadata: Metadata = {
  title: "Review Job",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminJobReviewPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const job = await getJobForAdmin(id);

  if (!job) {
    notFound();
  }

  const salary =
    job.salaryMin !== undefined && job.salaryMax !== undefined && job.currencyCode
      ? `${job.currencyCode} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`
      : "Not provided";

  return (
    <Section aria-labelledby="admin-job-review-heading" containerClassName="max-w-3xl">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 id="admin-job-review-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          {job.title}
        </h1>
        <Badge variant={JOB_STATUS_VARIANTS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </div>

      <Card padding="lg" className="mb-6 flex flex-col gap-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Company</dt>
            <dd className="text-foreground">{job.companyName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Location</dt>
            <dd className="text-foreground">
              {job.cityName}, {job.countryName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Category</dt>
            <dd className="text-foreground">{job.categoryName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Salary</dt>
            <dd className="text-foreground">{salary}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Application method</dt>
            <dd className="text-foreground">
              {job.applicationMethod === "external_url" ? (
                <a href={job.externalApplicationUrl} className="text-brand-600 hover:text-brand-700" target="_blank" rel="noopener noreferrer nofollow">
                  {job.externalApplicationUrl}
                </a>
              ) : (
                "On this platform"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Employer</dt>
            <dd className="text-foreground">
              {job.employerName} ({job.employerEmail})
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Submitted</dt>
            <dd className="text-foreground">{dateFormatter.format(new Date(job.createdAt))}</dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-1 text-sm text-muted-foreground">Description</h2>
          <p className="whitespace-pre-wrap text-foreground">{job.description}</p>
        </div>

        {job.rejectionReason ? (
          <div>
            <h2 className="mb-1 text-sm text-muted-foreground">Rejection reason</h2>
            <p className="text-foreground">{job.rejectionReason}</p>
          </div>
        ) : null}
      </Card>

      {job.status === "pending_review" ? (
        <Card padding="lg">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Decision</h2>
          <JobReviewActions jobId={job.id} />
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          This job has already been reviewed and can no longer be approved or rejected here.
        </p>
      )}
    </Section>
  );
}

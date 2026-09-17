import { Section } from "@/components/Section";
import { Container } from "@/components/Container";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { AdSlot } from "@/components/AdSlot";
import { getButtonClassName } from "@/components/Button";
import { JobCard } from "@/features/jobs/JobCard";
import type { PublicJobDetail } from "@/services/jobs/getPublicJobBySlug";
import type { JobListItem } from "@/features/jobs/types";

export type JobDetailViewProps = {
  job: PublicJobDetail;
  /** Other publishable jobs in the same country, current job already excluded. */
  relatedJobs: JobListItem[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSalary(job: PublicJobDetail): string | undefined {
  if (job.salaryMin === undefined || job.salaryMax === undefined || !job.currencyCode) {
    return undefined;
  }
  return `${job.currencyCode} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`;
}

export function JobDetailView({ job, relatedJobs }: JobDetailViewProps) {
  const salary = formatSalary(job);
  const hasExternalUrl = job.applicationMethod === "external_url" && Boolean(job.externalApplicationUrl);

  return (
    <>
      <Section aria-labelledby="job-title">
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{job.categoryName}</Badge>
            {job.skills.map((skill) => (
              <Badge key={skill} variant="brand">
                {skill}
              </Badge>
            ))}
          </div>
          <h1 id="job-title" className="text-2xl font-semibold text-foreground sm:text-3xl">
            {job.title}
          </h1>
          <p className="text-lg text-muted-foreground">{job.companyName}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              {job.city}, {job.countryName}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>Posted {formatDate(job.postedAt)}</span>
            {job.expiresAt ? (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>Applications close {formatDate(job.expiresAt)}</span>
              </>
            ) : null}
          </div>
          {salary ? <p className="text-base font-medium text-foreground">{salary}</p> : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Job Description</h2>
            <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {job.description}
            </div>
          </div>

          <aside>
            <Card padding="md" className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Apply</h2>
              {hasExternalUrl ? (
                <a
                  href={job.externalApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={getButtonClassName({ fullWidth: true })}
                >
                  Apply on company site
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    aria-describedby="apply-unavailable"
                    className={getButtonClassName({ fullWidth: true, className: "cursor-not-allowed" })}
                  >
                    Apply
                  </button>
                  <p id="apply-unavailable" className="text-sm text-muted-foreground">
                    On-platform applications aren&apos;t available yet. Check back soon.
                  </p>
                </>
              )}
            </Card>
          </aside>
        </div>
      </Section>

      <Container className="flex justify-center py-6">
        <AdSlot size="leaderboard" />
      </Container>

      {relatedJobs.length > 0 ? (
        <Section aria-labelledby="related-jobs-heading" className="bg-surface-muted">
          <h2 id="related-jobs-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
            More jobs in {job.countryName}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {relatedJobs.map((relatedJob) => (
              <li key={relatedJob.id}>
                <JobCard job={relatedJob} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

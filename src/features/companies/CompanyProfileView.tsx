import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { JobCard } from "@/features/jobs/JobCard";
import type { PublicCompanyDetail, RelatedCompany } from "@/services/jobs/getPublicCompanyBySlug";
import type { JobListItem } from "@/features/jobs/types";

export type CompanyProfileViewProps = {
  company: PublicCompanyDetail;
  breadcrumbItems: BreadcrumbItem[];
  openJobs: JobListItem[];
  relatedJobs: JobListItem[];
  relatedCompanies: RelatedCompany[];
};

/**
 * Presentational company profile page. Every section that depends on
 * optional/real data is conditionally rendered — never a placeholder,
 * never invented text — matching this task's own "if company
 * information is unavailable, gracefully omit" requirement exactly.
 */
export function CompanyProfileView({ company, breadcrumbItems, openJobs, relatedJobs, relatedCompanies }: CompanyProfileViewProps) {
  return (
    <>
      <Section aria-labelledby="company-name">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-8 flex flex-col gap-3">
          <h1 id="company-name" className="text-2xl font-semibold text-foreground sm:text-3xl">
            {company.name}
          </h1>
          <p className="text-muted-foreground">
            {company.openJobCount} open {company.openJobCount === 1 ? "role" : "roles"}
          </p>
          {company.websiteUrl ? (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Visit company website
            </a>
          ) : null}
        </div>

        {company.description ? (
          <Card padding="md" className="mb-8">
            <h2 className="mb-2 text-lg font-semibold text-foreground">About {company.name}</h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{company.description}</p>
          </Card>
        ) : null}

        {company.hiringCountries.length > 0 || company.hiringCategories.length > 0 ? (
          <div className="mb-10 flex flex-col gap-4">
            {company.hiringCountries.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Hiring in</h2>
                <div className="flex flex-wrap gap-2">
                  {company.hiringCountries.map((country) => (
                    <Link key={country.slug} href={`/${country.slug}/jobs`}>
                      <Badge variant="neutral">{country.name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {company.hiringCategories.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Job categories</h2>
                <div className="flex flex-wrap gap-2">
                  {company.hiringCategories.map((category) => (
                    <Link key={category.slug} href={`/jobs?category=${category.slug}`}>
                      <Badge variant="brand">{category.name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Open roles at {company.name}
          </h2>
          {openJobs.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {openJobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No open roles right now.</p>
          )}
        </div>

        {relatedCompanies.length > 0 ? (
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Related companies</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {relatedCompanies.map((related) => (
                <li key={related.id}>
                  <Link href={`/company/${related.slug}`}>
                    <Card padding="sm" className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{related.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {related.openJobCount} open {related.openJobCount === 1 ? "role" : "roles"}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {relatedJobs.length > 0 ? (
        <Section aria-labelledby="related-jobs-heading" className="bg-surface-muted">
          <h2 id="related-jobs-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
            More jobs like this
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {relatedJobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

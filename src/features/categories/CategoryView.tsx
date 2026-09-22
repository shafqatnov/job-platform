import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { JobCard } from "@/features/jobs/JobCard";
import type { PublicCategoryDetail, RelatedCategory } from "@/services/jobs/getPublicCategoryBySlug";
import type { JobListItem } from "@/features/jobs/types";

export type CategoryViewProps = {
  category: PublicCategoryDetail;
  breadcrumbItems: BreadcrumbItem[];
  jobs: JobListItem[];
  otherCategories: RelatedCategory[];
};

/**
 * Presentational category landing page. Every section depends only on
 * real data already resolved by getPublicCategoryBySlug/getPublicJobs —
 * nothing here is invented text, guessed statistics, or filler copy
 * (see this task's own AdSense/content-safety requirement). A category
 * with zero current public jobs still renders normally (its own genuine
 * empty state), matching CountryJobsPage's own precedent for an empty
 * country.
 */
export function CategoryView({ category, breadcrumbItems, jobs, otherCategories }: CategoryViewProps) {
  return (
    <>
      <Section aria-labelledby="category-name">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-8 flex flex-col gap-3">
          <h1 id="category-name" className="text-2xl font-semibold text-foreground sm:text-3xl">
            {category.name} Jobs
          </h1>
          <p className="text-muted-foreground">
            {category.openJobCount} open {category.openJobCount === 1 ? "role" : "roles"} in {category.name}
            {category.hiringCountries.length > 0
              ? ` across ${category.hiringCountries.length} ${category.hiringCountries.length === 1 ? "country" : "countries"}`
              : ""}
            {" "}on Jobnura.
          </p>
        </div>

        {category.hiringCountries.length > 0 || category.hiringCompanies.length > 0 ? (
          <div className="mb-10 flex flex-col gap-4">
            {category.hiringCountries.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">{category.name} jobs by country</h2>
                <div className="flex flex-wrap gap-2">
                  {category.hiringCountries.map((country) => (
                    <Link key={country.slug} href={`/${country.slug}/jobs?category=${category.slug}`}>
                      <Badge variant="neutral">{country.name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {category.hiringCompanies.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Companies hiring in {category.name}</h2>
                <div className="flex flex-wrap gap-2">
                  {category.hiringCompanies.map((company) => (
                    <Link key={company.slug} href={`/company/${company.slug}`}>
                      <Badge variant="brand">{company.name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Open {category.name} roles</h2>
          {jobs.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={`No ${category.name} jobs published yet`}
              description="New listings will appear here as soon as employers start posting in this category. Check back soon, or browse all open roles."
              action={
                <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Browse all jobs →
                </Link>
              }
            />
          )}
        </div>

        {otherCategories.length > 0 ? (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">Other categories with open roles</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {otherCategories.map((other) => (
                <li key={other.slug}>
                  <Link href={`/category/${other.slug}`}>
                    <Card padding="sm" className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{other.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {other.openJobCount} open {other.openJobCount === 1 ? "role" : "roles"}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>
    </>
  );
}

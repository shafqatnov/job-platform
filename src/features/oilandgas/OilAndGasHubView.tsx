import Link from "next/link";
import { Section } from "@/components/Section";
import { Container } from "@/components/Container";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { AdSlot } from "@/components/AdSlot";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { JobCard } from "@/features/jobs/JobCard";
import type { OilAndGasHubData } from "@/services/jobs/getOilAndGasHub";
import type { JobListItem } from "@/features/jobs/types";

export type OilAndGasHubViewProps = {
  hub: OilAndGasHubData;
  breadcrumbItems: BreadcrumbItem[];
  jobs: JobListItem[];
  currentPage: number;
  totalPages: number;
  previousHref?: string;
  nextHref?: string;
};

/**
 * Presentational Oil & Gas hub. Every number and every link comes from
 * real data already resolved by getOilAndGasHubData()/getPublicJobs() —
 * no invented statistics, salary claims, or employer claims, per this
 * task's own content-safety requirement. A hub with zero currently
 * qualifying jobs still renders normally (its own genuine empty state
 * for the job list), matching CategoryView's/CountryJobsPage's own
 * precedent for an empty listing — it never fabricates "latest jobs."
 */
export function OilAndGasHubView({
  hub,
  breadcrumbItems,
  jobs,
  currentPage,
  totalPages,
  previousHref,
  nextHref,
}: OilAndGasHubViewProps) {
  return (
    <>
      <Section aria-labelledby="oil-and-gas-heading">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mb-8 flex flex-col gap-3">
          <h1 id="oil-and-gas-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Oil &amp; Gas Jobs
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Browse Oil &amp; Gas roles on Jobnura, across Oil &amp; Gas, Petroleum, Drilling, and Offshore.{" "}
            {hub.totalJobCount > 0
              ? `${hub.totalJobCount} open ${hub.totalJobCount === 1 ? "role is" : "roles are"} currently listed${
                  hub.hiringCountries.length > 0
                    ? ` across ${hub.hiringCountries.length} ${hub.hiringCountries.length === 1 ? "country" : "countries"}`
                    : ""
                }.`
              : "New Oil & Gas listings will appear here as employers post them."}
          </p>
        </div>

        {hub.hiringCountries.length > 0 || hub.hiringCompanies.length > 0 ? (
          <div className="mb-10 flex flex-col gap-4">
            {hub.hiringCountries.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Popular hiring countries</h2>
                <div className="flex flex-wrap gap-2">
                  {hub.hiringCountries.map((country) => (
                    <Link key={country.slug} href={`/${country.slug}/jobs`}>
                      <Badge variant="neutral">{country.name}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {hub.hiringCompanies.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Hiring companies</h2>
                <div className="flex flex-wrap gap-2">
                  {hub.hiringCompanies.map((company) => (
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
          <h2 className="mb-4 text-sm font-semibold text-foreground">Oil &amp; Gas categories</h2>
          <div className="flex flex-wrap gap-2">
            {hub.coreCategories.map((category) => (
              <Link key={category.slug} href={`/category/${category.slug}`}>
                <Card padding="sm" className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{category.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {category.openJobCount} open {category.openJobCount === 1 ? "role" : "roles"}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Latest Oil &amp; Gas jobs</h2>
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
              title="No Oil & Gas jobs published yet"
              description="New listings will appear here as soon as employers start posting Oil & Gas roles. Check back soon, or browse all open roles."
              action={
                <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Browse all jobs →
                </Link>
              }
            />
          )}
          {totalPages > 1 ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              previousHref={previousHref}
              nextHref={nextHref}
              className="mt-6"
            />
          ) : null}
        </div>

        {hub.relatedCategories.length > 0 ? (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">Related engineering &amp; energy categories</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Adjacent fields also open on Jobnura — shown as their own category, not counted as Oil &amp; Gas roles.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {hub.relatedCategories.map((related) => (
                <li key={related.slug}>
                  <Link href={`/category/${related.slug}`}>
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

      <Container className="flex justify-center py-6">
        <AdSlot size="leaderboard" />
      </Container>
    </>
  );
}

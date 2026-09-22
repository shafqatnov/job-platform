import type { Metadata } from "next";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import {
  getPublicJobs,
  normalizePublicJobsPage,
  getPublicJobsPaginationInfo,
  PUBLIC_JOBS_PAGE_SIZE,
} from "@/services/jobs/getPublicJobs";
import { getOilAndGasHubData, OIL_AND_GAS_CATEGORY_SLUGS, type OilAndGasHubData } from "@/services/jobs/getOilAndGasHub";
import { OilAndGasHubView } from "@/features/oilandgas/OilAndGasHubView";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";

const TITLE = "Oil & Gas Jobs";
const path = "/oil-and-gas";

/** A searchParams entry can arrive as a string, an array (repeated key), or absent. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses a raw searchParams "page" value into a number for normalizePublicJobsPage — undefined stays undefined (defaults to page 1); anything else (including non-numeric text) is passed through as-is and safely normalized there, never guessed at here. */
function parsePage(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/**
 * Concise, factual description built only from real data already
 * resolved on the hub (real counts, real category names) — never an
 * invented industry statistic, salary claim, or employer claim, per
 * this task's own content-safety requirement.
 */
export function buildOilAndGasDescription(hub: Pick<OilAndGasHubData, "totalJobCount" | "hiringCountries">): string {
  const roleWord = hub.totalJobCount === 1 ? "role" : "roles";
  const countryClause =
    hub.hiringCountries.length > 0
      ? ` across ${hub.hiringCountries.length} ${hub.hiringCountries.length === 1 ? "country" : "countries"}`
      : "";
  return `${hub.totalJobCount} open Oil & Gas ${roleWord}${countryClause} on Jobnura, spanning Oil & Gas, Petroleum, Drilling, and Offshore.`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = normalizePublicJobsPage(parsePage(firstValue(params.page)));
  const siteUrl = getConfiguredSiteUrl();
  // Page 1's URL is the bare hub path; page 2+ gets its own
  // self-referencing canonical, never consolidated back to page 1 — the
  // exact same policy as /jobs/page.tsx and /category/[slug]/page.tsx.
  const pageUrl = page > 1 ? `${path}?page=${page}` : path;

  const hub = await getOilAndGasHubData();
  const description = buildOilAndGasDescription(hub);

  // Same "is this specific page empty" rule as /jobs and /category/[slug]
  // — never a hardcoded/cached answer, re-evaluated every request from
  // the real current qualifying job count. Reuses hub.totalJobCount
  // (already computed by getOilAndGasHubData, itself cache()-deduped
  // against this same request's page render) instead of a second count
  // query.
  const hasResultsOnThisPage = (page - 1) * PUBLIC_JOBS_PAGE_SIZE < hub.totalJobCount;

  return {
    title: TITLE,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${pageUrl}` } } : {}),
    ...(hasResultsOnThisPage ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: TITLE,
      description,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${pageUrl}` } : {}),
    },
    twitter: {
      card: "summary",
      title: TITLE,
      description,
    },
  };
}

export default async function OilAndGasHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = normalizePublicJobsPage(parsePage(firstValue(params.page)));

  const hub = await getOilAndGasHubData();
  const jobs = await getPublicJobs({ categorySlugs: [...OIL_AND_GAS_CATEGORY_SLUGS], page });
  const { totalPages, hasPreviousPage, hasNextPage } = getPublicJobsPaginationInfo(page, hub.totalJobCount);

  function pageHref(targetPage: number): string {
    return targetPage > 1 ? `${path}?page=${targetPage}` : path;
  }

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Oil & Gas Jobs" },
  ];
  const siteUrl = getConfiguredSiteUrl();
  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <OilAndGasHubView
        hub={hub}
        breadcrumbItems={breadcrumbItems}
        jobs={jobs}
        currentPage={page}
        totalPages={totalPages}
        previousHref={hasPreviousPage ? pageHref(page - 1) : undefined}
        nextHref={hasNextPage ? pageHref(page + 1) : undefined}
      />
    </>
  );
}

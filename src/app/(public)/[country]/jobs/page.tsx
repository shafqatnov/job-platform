import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountryBySlug } from "@/constants/countries";
import { JobsListingView } from "@/features/jobs/JobsListingView";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export async function generateMetadata({
  params,
}: PageProps<"/[country]/jobs">): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = getCountryBySlug(countrySlug);

  // Not calling notFound() here: metadata generation runs in a separate
  // phase from rendering the page, and doing so did not resolve to this
  // segment's not-found.tsx in testing. The page component below is the
  // single source of truth for the 404 decision.
  if (!country) {
    return { title: "Jobs" };
  }

  const title = `Jobs in ${country.name}`;
  const description = `Browse open roles in ${country.name} across multiple industries. Filter by category, location, and work type to find your next opportunity.`;
  const siteUrl = getConfiguredSiteUrl();
  // Only ever built from a country slug that has already resolved to a
  // real, known country above — never an invalid/guessed one.
  const path = `/${country.slug}/jobs`;

  return {
    title,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

/** A searchParams entry can arrive as a string, an array (repeated key), or absent. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CountryJobsPage({
  params,
  searchParams,
}: PageProps<"/[country]/jobs"> & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { country: countrySlug } = await params;
  const country = getCountryBySlug(countrySlug);

  if (!country) {
    notFound();
  }

  const query = await searchParams;

  return (
    <JobsListingView
      country={country}
      filters={{
        keywords: firstValue(query.q),
        categorySlug: firstValue(query.category),
      }}
    />
  );
}

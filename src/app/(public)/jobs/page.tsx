import type { Metadata } from "next";
import { JobsListingView } from "@/features/jobs/JobsListingView";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Browse All Jobs";
const DESCRIPTION =
  "Browse open roles across multiple countries and industries. Filter by category, location, and work type to find your next opportunity.";

const siteUrl = getConfiguredSiteUrl();
const path = "/jobs";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/** A searchParams entry can arrive as a string, an array (repeated key), or absent. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <JobsListingView
      filters={{
        keywords: firstValue(params.q),
        countryCode: firstValue(params.country),
        categorySlug: firstValue(params.category),
      }}
    />
  );
}

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

export default function JobsPage() {
  return <JobsListingView />;
}

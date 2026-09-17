import type { Metadata } from "next";
import { JobsListingView } from "@/features/jobs/JobsListingView";

export const metadata: Metadata = {
  title: "Browse All Jobs",
  description:
    "Browse open roles across multiple countries and industries. Filter by category, location, and work type to find your next opportunity.",
};

export default function JobsPage() {
  return <JobsListingView />;
}

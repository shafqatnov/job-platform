import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { JobSourcesTable } from "@/features/admin/JobSourcesTable";
import { listJobSources } from "@/services/admin/jobSources";

export const metadata: Metadata = {
  title: "Job Sources",
  robots: { index: false, follow: false },
};

/**
 * Foundation step of the future AI Job Acquisition Engine: an
 * admin-only view of the Authorized Job Source registry. This page only
 * reads/toggles configuration rows — it never fetches from an external
 * API and never imports a job. Protected by the (dashboard)/admin
 * layout's existing admin-only guard; no separate auth check is added
 * here.
 */
export default async function AdminJobSourcesPage() {
  const sources = await listJobSources();

  return (
    <Section aria-labelledby="job-sources-heading">
      <h1 id="job-sources-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Job Sources
      </h1>
      <p className="mb-8 text-muted-foreground">
        Authorized sources for the future AI Job Acquisition Engine. This registry only stores configuration —
        enabling a source here does not import any jobs.
      </p>
      <Card padding="lg">
        <JobSourcesTable sources={sources} />
      </Card>
    </Section>
  );
}

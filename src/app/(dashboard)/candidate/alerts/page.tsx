import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Job Alerts",
  robots: { index: false, follow: false },
};

/**
 * Honest placeholder — there is no job-alert infrastructure anywhere in
 * this codebase (no model, no email-sending service, no scheduled job).
 * Per this task's own instruction, this page prepares the dashboard
 * section and states the real current state plainly rather than
 * fabricating alerts or implying email alerts already work.
 */
export default function CandidateAlertsPage() {
  return (
    <Section aria-labelledby="alerts-heading" containerClassName="max-w-xl">
      <h1 id="alerts-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Job alerts
      </h1>
      <Card padding="lg">
        <EmptyState
          title="No alerts configured"
          description="Job alerts aren't available yet. When this feature launches, you'll be able to get notified about new jobs matching your preferences."
        />
      </Card>
    </Section>
  );
}

import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Recently Viewed",
  robots: { index: false, follow: false },
};

/**
 * Honest placeholder — there is no job-view tracking infrastructure
 * anywhere in this codebase (no model, no event log, no client-side
 * tracking call). Per this task's own instruction ("if it does not
 * exist: report it — do not invent tracking architecture without
 * justification"), this page states the real current state rather than
 * inventing a view-history feature or a new tracking model.
 */
export default function CandidateRecentlyViewedPage() {
  return (
    <Section aria-labelledby="recently-viewed-heading" containerClassName="max-w-xl">
      <h1 id="recently-viewed-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Recently viewed
      </h1>
      <Card padding="lg">
        <EmptyState
          title="Not yet available"
          description="Jobnura doesn't track recently viewed jobs yet. This section is reserved for that feature once it's built."
        />
      </Card>
    </Section>
  );
}

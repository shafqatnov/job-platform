import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Hiring Pipeline",
  robots: { index: false, follow: false },
};

/**
 * Honest placeholder — there is no multi-stage application pipeline
 * anywhere in this codebase. ApplicationStatus (see
 * src/constants/applicationStatus.ts) currently defines only one real
 * state, "received"; there is no shortlisted/interviewing/offer/hired
 * status, no stage-transition logic, and no schema support for one.
 * This page states that plainly rather than fabricating pipeline
 * stages or candidate counts.
 */
export default function EmployerPipelinePage() {
  return (
    <Section aria-labelledby="pipeline-heading" containerClassName="max-w-xl">
      <h1 id="pipeline-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Hiring pipeline
      </h1>
      <Card padding="lg">
        <EmptyState
          title="Not yet available"
          description="A multi-stage hiring pipeline (shortlisted, interviewing, offer) isn't available yet. Track applications from the Applications page in the meantime."
        />
      </Card>
    </Section>
  );
}

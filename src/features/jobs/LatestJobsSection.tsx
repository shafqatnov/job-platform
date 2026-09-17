import { Section } from "@/components/Section";
import { EmptyState } from "@/components/EmptyState";

export function LatestJobsSection() {
  return (
    <Section aria-labelledby="latest-jobs-heading" className="bg-surface-muted">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="latest-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Latest Jobs
        </h2>
        <p className="text-muted-foreground">The newest roles as employers publish them.</p>
      </div>
      <EmptyState
        title="No jobs published yet"
        description="This is where the newest listings will appear the moment employers start posting — check back soon."
      />
    </Section>
  );
}

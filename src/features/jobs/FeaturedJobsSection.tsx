import Link from "next/link";
import { Section } from "@/components/Section";
import { EmptyState } from "@/components/EmptyState";

export function FeaturedJobsSection() {
  return (
    <Section aria-labelledby="featured-jobs-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="featured-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Featured Jobs
        </h2>
        <p className="text-muted-foreground">Hand-picked roles from employers, once listings go live.</p>
      </div>
      <EmptyState
        title="Featured jobs are coming soon"
        description="Employers haven't published featured listings yet. Check back shortly, or explore the full job search in the meantime."
        action={
          <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Browse all jobs →
          </Link>
        }
      />
    </Section>
  );
}

import Link from "next/link";
import { Section } from "@/components/Section";

export function EmployerCta() {
  return (
    <Section aria-labelledby="employer-cta-heading">
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-brand-600 p-8 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 id="employer-cta-heading" className="text-2xl font-semibold sm:text-3xl">
            Hiring? Reach candidates worldwide.
          </h2>
          <p className="max-w-xl text-brand-50">
            Post a job and manage applicants in one place, across every market you hire in.
          </p>
        </div>
        <Link
          href="/employers"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-md border border-white px-6 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
        >
          Post a Job
        </Link>
      </div>
    </Section>
  );
}

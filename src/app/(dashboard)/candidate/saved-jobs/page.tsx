import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { JobCard } from "@/features/jobs/JobCard";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { getSavedJobs } from "@/services/candidates/getSavedJobs";

export const metadata: Metadata = {
  title: "Saved Jobs",
  robots: { index: false, follow: false },
};

export default async function SavedJobsPage() {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  if (!profile) {
    return (
      <Section aria-labelledby="saved-jobs-heading">
        <h1 id="saved-jobs-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          Saved jobs
        </h1>
        <Card padding="lg">
          <EmptyState
            title="You haven't created a profile yet"
            description="Create your candidate profile to save jobs and apply to them."
            action={
              <Link href="/candidate/profile/create" className={getButtonClassName({ size: "sm" })}>
                Create profile
              </Link>
            }
          />
        </Card>
      </Section>
    );
  }

  const jobs = await getSavedJobs(profile.id);

  return (
    <Section aria-labelledby="saved-jobs-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="saved-jobs-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Saved jobs
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} saved
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No saved jobs yet"
            description="Jobs you save will appear here so you can come back to them later."
            action={
              <Link href="/jobs" className={getButtonClassName({ variant: "outline", size: "sm" })}>
                Browse jobs
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              {/* Every job here is, by definition of this query, currently saved. */}
              <JobCard job={job} saveState="saved" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

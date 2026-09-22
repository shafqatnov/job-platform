import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { JobCard } from "@/features/jobs/JobCard";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { getRecommendedJobsForCandidate } from "@/services/candidates/getRecommendedJobs";

export const metadata: Metadata = {
  title: "Recommended Jobs",
  robots: { index: false, follow: false },
};

export default async function CandidateRecommendedJobsPage() {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  if (!profile) {
    return (
      <Section aria-labelledby="recommended-heading">
        <h1 id="recommended-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          Recommended jobs
        </h1>
        <Card padding="lg">
          <EmptyState
            title="You haven't created a profile yet"
            description="Create your candidate profile so we know which country to recommend jobs in."
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

  const jobs = await getRecommendedJobsForCandidate(profile.id, profile.countrySlug);

  return (
    <Section aria-labelledby="recommended-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h1 id="recommended-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Recommended jobs
        </h1>
        <p className="text-muted-foreground">
          Based on your country ({profile.countryName}) — jobs you haven&apos;t already saved or applied to.
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No recommendations right now"
            description={`We couldn't find any new public jobs in ${profile.countryName} you haven't already saved or applied to. Check back soon, or browse all jobs.`}
            action={
              <Link href="/jobs" className={getButtonClassName({ variant: "outline", size: "sm" })}>
                Browse all jobs
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

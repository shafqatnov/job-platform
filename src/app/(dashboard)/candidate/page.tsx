import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { JobCard } from "@/features/jobs/JobCard";
import { getProfileCompletion } from "@/features/candidates/profileCompletion";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { getSavedJobs } from "@/services/candidates/getSavedJobs";
import { getApplicationsForCandidate } from "@/services/applications/getApplicationsForCandidate";
import { getRecommendedJobsForCandidate } from "@/services/candidates/getRecommendedJobs";

export const metadata: Metadata = {
  title: "Candidate Dashboard",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
const DASHBOARD_PREVIEW_LIMIT = 3;

/**
 * Candidate Portal 2.0's home page. Every number, every job, and every
 * status shown here comes from the candidate's own real data (saved
 * jobs, applications, profile, resume) fetched through the exact same
 * services their own dedicated pages already use — this page adds no
 * new data-access path, it only previews the first few results of each
 * and links to the full page for the rest.
 */
export default async function CandidateDashboardPage() {
  // The layout above already guarantees a valid, active candidate
  // session; user is only possibly null here to satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  return (
    <Section aria-labelledby="candidate-dashboard-heading">
      <div className="mb-8">
        <h1 id="candidate-dashboard-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Candidate Dashboard
        </h1>
        {user ? <p className="text-muted-foreground">Signed in as {user.email}</p> : null}
      </div>

      {!profile ? (
        <Card padding="lg" className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Finish setting up your profile</h2>
          <p className="mb-4 text-muted-foreground">
            Create your candidate profile to apply to jobs and save listings for later.
          </p>
          <Link href="/candidate/profile/create" className={getButtonClassName({ size: "sm" })}>
            Create profile
          </Link>
        </Card>
      ) : (
        <CandidateDashboardOverview profile={profile} />
      )}
    </Section>
  );
}

export async function CandidateDashboardOverview({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getCandidateProfile>>>;
}) {
  const [savedJobs, applications, recommendedJobs] = await Promise.all([
    getSavedJobs(profile.id),
    getApplicationsForCandidate(profile.id),
    getRecommendedJobsForCandidate(profile.id, profile.countrySlug),
  ]);
  const completion = getProfileCompletion(profile);

  return (
    <div className="flex flex-col gap-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">{profile.fullName}</h2>
            {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}
          </div>
          <Link href="/candidate/profile" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Edit profile
          </Link>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Profile completion</span>
            <span className="text-muted-foreground">{completion.percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted" role="presentation">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width]"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          {completion.percent < 100 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Still missing: {completion.items.filter((item) => !item.complete).map((item) => item.label).join(", ")}
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Saved jobs</h2>
            <Link href="/candidate/saved-jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all ({savedJobs.length})
            </Link>
          </div>
          {savedJobs.length === 0 ? (
            <EmptyState title="No saved jobs yet" description="Jobs you save will appear here." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {savedJobs.slice(0, DASHBOARD_PREVIEW_LIMIT).map((job) => (
                <li key={job.id}>
                  <JobCard job={job} saveState="saved" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Applications</h2>
            <Link href="/candidate/applications" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all ({applications.length})
            </Link>
          </div>
          {applications.length === 0 ? (
            <EmptyState title="No applications yet" description="Jobs you apply to will appear here." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {applications.slice(0, DASHBOARD_PREVIEW_LIMIT).map((application) => (
                <li key={application.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/${application.countrySlug}/jobs/${application.jobSlug}`}
                    className="font-medium text-foreground hover:text-brand-700"
                  >
                    {application.jobTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {application.companyName} &middot; {application.countryName} &middot; Applied{" "}
                    {dateFormatter.format(new Date(application.appliedDate))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Resume</h2>
            <Link href="/candidate/resume" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {profile.hasResume ? "Manage resume" : "Upload resume"}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.hasResume ? "You have a resume on file." : "You haven't uploaded a resume yet."}
          </p>
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Job alerts</h2>
            <Link href="/candidate/alerts" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">No alerts configured.</p>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recommended for you</h2>
          <Link href="/candidate/recommended" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>
        {recommendedJobs.length === 0 ? (
          <EmptyState
            title="No recommendations right now"
            description={`We couldn't find any new public jobs in ${profile.countryName} you haven't already saved or applied to.`}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedJobs.slice(0, DASHBOARD_PREVIEW_LIMIT).map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getButtonClassName } from "@/components/Button";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";

export const metadata: Metadata = {
  title: "Candidate Dashboard",
  robots: { index: false, follow: false },
};

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
        <Card padding="lg" className="mb-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">{profile.fullName}</h2>
          {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/candidate/profile" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
          <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
            <h2 className="mb-1 text-base font-semibold text-foreground">Your profile</h2>
            <p className="text-sm text-muted-foreground">View and edit your details.</p>
          </Card>
        </Link>
        <Link href="/candidate/saved-jobs" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
          <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
            <h2 className="mb-1 text-base font-semibold text-foreground">Saved jobs</h2>
            <p className="text-sm text-muted-foreground">Jobs you&apos;ve bookmarked to apply to later.</p>
          </Card>
        </Link>
        <Link href="/candidate/applications" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
          <Card padding="lg" className="h-full transition-colors hover:border-brand-600">
            <h2 className="mb-1 text-base font-semibold text-foreground">My applications</h2>
            <p className="text-sm text-muted-foreground">Track jobs you&apos;ve applied to.</p>
          </Card>
        </Link>
      </div>
    </Section>
  );
}

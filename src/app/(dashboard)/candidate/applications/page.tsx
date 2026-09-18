import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { getApplicationsForCandidate } from "@/services/applications/getApplicationsForCandidate";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "My Applications",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Candidate-facing status label — deliberately separate from
 * src/constants/applicationStatus.ts's APPLICATION_STATUS_LABELS, which
 * is the EMPLOYER-facing label ("Applied", from the employer's point of
 * view that a candidate applied) for the same underlying value. From
 * the candidate's own point of view the accurate phrasing is "Received"
 * (their application was received) — reusing the shared employer-facing
 * constant here would silently change its meaning without changing its
 * name, and editing that constant would change the employer
 * applications page's own display, which is out of scope. The schema
 * currently defines only `received` (see docs/20-application-flow.md);
 * no shortlisted/interviewing/rejected status exists anywhere yet.
 */
const CANDIDATE_APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  received: "Received",
};

export default async function CandidateApplicationsPage() {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  if (!profile) {
    return (
      <Section aria-labelledby="applications-heading">
        <h1 id="applications-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          My applications
        </h1>
        <Card padding="lg">
          <EmptyState
            title="You haven't created a profile yet"
            description="Create your candidate profile to start applying to jobs."
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

  const applications = await getApplicationsForCandidate(profile.id);

  return (
    <Section aria-labelledby="applications-heading">
      <h1 id="applications-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        My applications
      </h1>
      <p className="mb-8 text-muted-foreground" aria-live="polite">
        {applications.length} {applications.length === 1 ? "application" : "applications"}
      </p>

      <Card padding="lg">
        {applications.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Jobs you apply to will appear here."
            action={
              <Link href="/jobs" className={getButtonClassName({ variant: "outline", size: "sm" })}>
                Browse jobs
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/${application.countrySlug}/jobs/${application.jobSlug}`}
                    className="font-medium text-foreground hover:text-brand-700"
                  >
                    {application.jobTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">{application.companyName}</p>
                </div>
                <span className="text-sm text-muted-foreground">
                  Applied {dateFormatter.format(new Date(application.appliedDate))}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {CANDIDATE_APPLICATION_STATUS_LABEL[application.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

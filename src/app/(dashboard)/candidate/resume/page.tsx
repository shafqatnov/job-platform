import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { ResumeUploadField } from "@/features/candidates/ResumeUploadField";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";

export const metadata: Metadata = {
  title: "Resume",
  robots: { index: false, follow: false },
};

/**
 * Candidate Portal 2.0's own dedicated Resume destination — reuses the
 * exact same ResumeUploadField component (upload/download/remove logic
 * entirely unchanged) already embedded on the profile page; this page
 * exists only to give Resume its own reachable URL in the persistent
 * candidate nav, not to duplicate or alter any resume business logic.
 */
export default async function CandidateResumePage() {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  if (!profile) {
    return (
      <Section aria-labelledby="resume-heading" containerClassName="max-w-xl">
        <h1 id="resume-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          Resume
        </h1>
        <Card padding="lg">
          <EmptyState
            title="You haven't created a profile yet"
            description="Create your candidate profile before uploading a resume."
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

  return (
    <Section aria-labelledby="resume-heading" containerClassName="max-w-xl">
      <h1 id="resume-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Resume
      </h1>
      <Card padding="lg">
        <ResumeUploadField hasResume={profile.hasResume} />
      </Card>
    </Section>
  );
}

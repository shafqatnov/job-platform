import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export type CandidateApplicationRow = {
  id: string;
  jobTitle: string;
  jobSlug: string;
  countrySlug: string;
  companyName: string;
  appliedDate: string;
  status: ApplicationStatus;
};

/**
 * Reads the real applications submitted BY one candidate, for their own
 * "My Applications" view — mirrors
 * src/services/applications/getApplicationsForJob.ts exactly, just
 * scoped by candidateProfileId instead of jobId. Callers are
 * responsible for deriving candidateProfileId from the authenticated
 * session (never a client-supplied value) before calling this — this
 * function trusts the id it's given, same trust boundary as the
 * employer-side function.
 *
 * Deliberately NOT filtered by the job's current status/expiry/deletion
 * — unlike the saved-jobs list (a "browse again" surface, where an
 * expired job should disappear), an applications HISTORY is exactly
 * that: a record of what was applied to, regardless of what later
 * happened to the listing.
 */
export async function getApplicationsForCandidate(candidateProfileId: string): Promise<CandidateApplicationRow[]> {
  const applications = await prisma.application.findMany({
    where: { candidateProfileId, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: {
        select: {
          title: true,
          slug: true,
          country: { select: { urlSlug: true } },
          company: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications.map((application) => ({
    id: application.id,
    jobTitle: application.job.title,
    jobSlug: application.job.slug,
    countrySlug: application.job.country.urlSlug,
    companyName: application.job.company.name,
    appliedDate: application.createdAt.toISOString(),
    status: application.status,
  }));
}

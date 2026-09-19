import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export type JobApplicationRow = {
  id: string;
  candidateName: string;
  candidateHeadline: string | null;
  candidateCountryName: string;
  candidateCityName: string | null;
  coverNote: string | null;
  appliedDate: string;
  status: ApplicationStatus;
};

/**
 * Reads the real applications submitted to one job, for the employer's
 * per-job applications view. Callers are responsible for verifying the
 * requesting employer actually owns this job (see
 * src/services/jobs/getEmployerJobDetail.ts) before calling this —
 * this function trusts the jobId it's given. This is the ONLY employer-
 * facing read of CandidateProfile data, and it only ever reaches a
 * candidate's profile through a real Application row scoped to this
 * jobId — never a client-supplied candidateProfileId (docs/06's "the
 * employer module does not directly read candidate profile data"
 * principle, applied here as narrowly as possible).
 *
 * Deliberately does NOT select resumeFileUrl or the candidate's email
 * (User.email) — out of scope for this task; adding either later needs
 * its own explicit authorization review, not a silent addition here.
 */
export async function getApplicationsForJob(jobId: string): Promise<JobApplicationRow[]> {
  const applications = await prisma.application.findMany({
    where: { jobId, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      coverNote: true,
      candidateProfile: {
        select: {
          fullName: true,
          headline: true,
          country: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications.map((application) => ({
    id: application.id,
    candidateName: application.candidateProfile.fullName,
    candidateHeadline: application.candidateProfile.headline,
    candidateCountryName: application.candidateProfile.country.name,
    candidateCityName: application.candidateProfile.city?.name ?? null,
    coverNote: application.coverNote,
    appliedDate: application.createdAt.toISOString(),
    status: application.status,
  }));
}

import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export type EmployerApplicationDetail = {
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
 * Reads exactly one application for the employer's per-application
 * detail view. Callers are responsible for verifying the requesting
 * employer actually owns the job first (see
 * src/services/jobs/getEmployerJobDetail.ts) and passing that
 * already-verified job.id here — this function trusts the jobId it's
 * given, exactly like getApplicationsForJob.ts.
 *
 * The WHERE clause scopes by BOTH applicationId and jobId together, not
 * applicationId alone: a real application id that belongs to a
 * DIFFERENT job (even one under the same company) must not match, so a
 * client cannot substitute a foreign applicationId onto an otherwise
 * correctly-owned job URL. There is no candidateProfileId or candidate
 * userId parameter anywhere in this function for the same reason
 * getApplicationsForJob has none — a candidate's profile is only ever
 * reached through this exact, already-scoped Application relation.
 *
 * Deliberately does NOT select resumeFileUrl or the candidate's email
 * (User.email) — out of scope for this task, matching
 * getApplicationsForJob.ts's own documented exclusion.
 */
export async function getApplicationForEmployer(
  applicationId: string,
  jobId: string
): Promise<EmployerApplicationDetail | null> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobId, deletedAt: null },
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
  });

  if (!application) {
    return null;
  }

  return {
    id: application.id,
    candidateName: application.candidateProfile.fullName,
    candidateHeadline: application.candidateProfile.headline,
    candidateCountryName: application.candidateProfile.country.name,
    candidateCityName: application.candidateProfile.city?.name ?? null,
    coverNote: application.coverNote,
    appliedDate: application.createdAt.toISOString(),
    status: application.status,
  };
}

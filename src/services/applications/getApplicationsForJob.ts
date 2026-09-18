import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export type JobApplicationRow = {
  id: string;
  candidateName: string;
  appliedDate: string;
  status: ApplicationStatus;
};

/**
 * Reads the real applications submitted to one job, for the employer's
 * per-job applications view. Callers are responsible for verifying the
 * requesting employer actually owns this job (see
 * src/services/jobs/getEmployerJobDetail.ts) before calling this —
 * this function trusts the jobId it's given.
 */
export async function getApplicationsForJob(jobId: string): Promise<JobApplicationRow[]> {
  const applications = await prisma.application.findMany({
    where: { jobId, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      candidateProfile: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications.map((application) => ({
    id: application.id,
    candidateName: application.candidateProfile.fullName,
    appliedDate: application.createdAt.toISOString(),
    status: application.status,
  }));
}

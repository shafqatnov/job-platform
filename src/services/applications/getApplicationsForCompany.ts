import { prisma } from "@/lib/prisma";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export type CompanyApplicationRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateHeadline: string | null;
  candidateCountryName: string;
  candidateCityName: string | null;
  appliedDate: string;
  status: ApplicationStatus;
};

/**
 * Reads the real applications submitted across ALL of one employer's
 * jobs, for Employer Portal 2.0's company-wide "Applications" view —
 * mirrors getApplicationsForJob.ts's own shape and privacy boundary
 * exactly (same candidate fields exposed, same fields deliberately
 * withheld: no resumeFileUrl, no candidate email), just scoped by
 * job.companyId instead of a single jobId.
 *
 * Callers are responsible for deriving companyId from the authenticated
 * employer's own session (see getEmployerCompany.ts) before calling
 * this — this function trusts the id it's given, same trust boundary as
 * every other employer-scoped read.
 */
export async function getApplicationsForCompany(companyId: string): Promise<CompanyApplicationRow[]> {
  const applications = await prisma.application.findMany({
    where: { job: { companyId }, deletedAt: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: { select: { id: true, title: true } },
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
    jobId: application.job.id,
    jobTitle: application.job.title,
    candidateName: application.candidateProfile.fullName,
    candidateHeadline: application.candidateProfile.headline,
    candidateCountryName: application.candidateProfile.country.name,
    candidateCityName: application.candidateProfile.city?.name ?? null,
    appliedDate: application.createdAt.toISOString(),
    status: application.status,
  }));
}

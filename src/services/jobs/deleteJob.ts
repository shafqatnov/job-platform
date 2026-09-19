import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";

export type DeleteJobResult = { success: true } | { success: false; error: string };

export const JOB_HAS_DEPENDENTS_ERROR =
  "This job cannot be permanently deleted because it has associated application data. You can close the job instead.";

/**
 * Permanently removes one of the authenticated employer's own jobs from
 * every view — implemented as a soft-delete (Job.deletedAt = now()),
 * REUSING the field every existing read path already filters on
 * (getPublicJobs, getPublicJobBySlug, getPublicJobsForSitemap,
 * getEmployerJobs, getEmployerJobDetail, getJobForAdmin,
 * listAdminJobs), never a raw row DELETE. This matches this project's
 * own documented decision (docs/26-database-schema-design.md: "No hard
 * delete of Job rows through normal lifecycle transitions... preserving
 * application history and audit trails") — deletedAt already exists and
 * is already wired everywhere; this is simply the first code path that
 * ever sets it.
 *
 * Blocked whenever the job has any Application or SavedJob row: this is
 * a deliberate product-safety rule (never let an employer make a
 * listing a candidate already engaged with disappear), not a database
 * necessity — soft-delete alone could never violate a foreign key,
 * since the Job row itself is never removed. Both checks apply even
 * though the exact required UI message below only names "application
 * data," since a saved-job bookmark is exactly the same kind of
 * candidate history this rule exists to protect.
 */
export async function deleteJob(userId: string, jobId: string): Promise<DeleteJobResult> {
  const employerCompany = await getEmployerCompany(userId);
  if (!employerCompany) {
    return { success: false, error: "Set up your company before managing jobs." };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: employerCompany.companyId, deletedAt: null },
    select: {
      id: true,
      _count: { select: { applications: { where: { deletedAt: null } }, savedBy: true } },
    },
  });

  if (!job) {
    return { success: false, error: "Job not found." };
  }
  if (job._count.applications > 0 || job._count.savedBy > 0) {
    return { success: false, error: JOB_HAS_DEPENDENTS_ERROR };
  }

  const result = await prisma.job.updateMany({
    where: { id: jobId, companyId: employerCompany.companyId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return { success: false, error: "Job not found." };
  }

  revalidatePath("/jobs");
  revalidatePath("/");

  return { success: true };
}

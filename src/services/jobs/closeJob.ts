import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";

export type CloseJobResult = { success: true } | { success: false; error: string };

/**
 * Closes (unpublishes) one of the authenticated employer's own active
 * jobs — docs/18-job-lifecycle.md's "closed — manually closed by the
 * employer or admin before natural expiry." A single conditional
 * updateMany scoped by companyId AND status = active is both the
 * ownership check and the concurrency guarantee in one: a job belonging
 * to a different company, or not currently active, simply doesn't
 * match and reports back a safe error rather than silently doing
 * nothing or acting on the wrong row.
 *
 * Existing public-visibility rules (getPublicJobs.ts,
 * getPublicJobBySlug.ts, getPublicJobsForSitemap.ts) already exclude
 * anything that isn't status = active — closing a job removes it from
 * every public surface with no further change needed anywhere else.
 */
export async function closeJob(userId: string, jobId: string): Promise<CloseJobResult> {
  const employerCompany = await getEmployerCompany(userId);
  if (!employerCompany) {
    return { success: false, error: "Set up your company before managing jobs." };
  }

  const result = await prisma.job.updateMany({
    where: { id: jobId, companyId: employerCompany.companyId, status: "active", deletedAt: null },
    data: { status: "closed", closedAt: new Date() },
  });

  if (result.count === 0) {
    return { success: false, error: "This job cannot be closed from its current state." };
  }

  // Same stale-static-page reasoning as approveJob.ts/expireJobs.ts: /jobs
  // and / are fully static and would otherwise keep showing this job as
  // active until the next deployment.
  revalidatePath("/jobs");
  revalidatePath("/");

  return { success: true };
}

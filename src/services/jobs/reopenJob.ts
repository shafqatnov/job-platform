import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";

export type ReopenJobResult = { success: true } | { success: false; error: string };

/**
 * Reopens one of the authenticated employer's own closed jobs back to
 * active — docs/18-job-lifecycle.md recommends employers can "manually
 * close or renew" a listing; reopening a voluntarily-closed job is the
 * safe half of that (renewing/extending expiry is a separate, undefined
 * feature this task does not build — see the final report).
 *
 * Deliberately only ever transitions FROM `closed`, never from
 * `expired` or `rejected`:
 *  - `expired` means expiresAt has already passed. Reopening straight
 *    to `active` would just be flipped back to `expired` by the very
 *    next cron run (src/services/jobs/expireJobs.ts matches any active
 *    job whose expiresAt <= now) with no expiry decision made — that
 *    would require inventing a "renew" feature this task doesn't ask
 *    for, so it's out of scope rather than guessed at.
 *  - `rejected` failed content moderation, a human/AI decision — the
 *    safe equivalent of "reopening" that is admin re-review via the
 *    EXISTING approve/reject flow (src/services/admin/moderateJob.ts),
 *    which this task leaves untouched, not a lifecycle toggle here.
 *
 * A closed job whose expiresAt has already passed is also blocked for
 * the same reason as `expired` above — reopening it would be
 * immediately undone by the cron.
 */
export async function reopenJob(userId: string, jobId: string): Promise<ReopenJobResult> {
  const employerCompany = await getEmployerCompany(userId);
  if (!employerCompany) {
    return { success: false, error: "Set up your company before managing jobs." };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: employerCompany.companyId, deletedAt: null },
    select: { status: true, expiresAt: true },
  });

  if (!job) {
    return { success: false, error: "Job not found." };
  }
  if (job.status !== "closed") {
    return { success: false, error: "This job cannot be reopened from its current state." };
  }
  if (job.expiresAt && job.expiresAt <= new Date()) {
    return { success: false, error: "This job's listing period has already ended and cannot be reopened." };
  }

  const result = await prisma.job.updateMany({
    where: { id: jobId, companyId: employerCompany.companyId, status: "closed", deletedAt: null },
    data: { status: "active", closedAt: null },
  });

  if (result.count === 0) {
    return { success: false, error: "This job cannot be reopened from its current state." };
  }

  revalidatePath("/jobs");
  revalidatePath("/");

  return { success: true };
}

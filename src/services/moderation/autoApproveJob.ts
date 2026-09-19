import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LISTING_DURATION_DAYS } from "@/constants/jobLifecycle";

export type AutoApproveResult = { success: true } | { success: false; reason: "not_eligible" };

/**
 * The automated pipeline's own publish action — deliberately separate
 * from src/services/admin/moderateJob.ts's approveJob(). That function
 * requires a real human adminUserId to satisfy ModerationAction's
 * required foreign key; an automated decision has no human admin, and
 * inventing a fake "AI admin" User row just to satisfy that constraint
 * is explicitly out of scope for this task. Human-admin approvals and
 * automated approvals therefore stay on two distinct, clearly-separate
 * code paths — this one never writes a ModerationAction row.
 *
 * Uses the exact same lifecycle transition as the human path (status ->
 * active, postedAt -> now, expiresAt -> +LISTING_DURATION_DAYS unless
 * the employer already requested a specific expiry at submission —
 * Version 1.1's optional expiry field, src/services/jobs/createJob.ts —
 * in which case that value is preserved instead, per docs/18) via a
 * single conditional updateMany, not a read-then-write — this is the
 * actual concurrency guarantee: the WHERE clause requires status =
 * pending_review, so two overlapping pipeline runs (or a pipeline run
 * racing a human admin's decision) can never both "win" the same job.
 * Whichever update lands first flips the status, and the other's WHERE
 * clause no longer matches.
 *
 * A short read-then-write (fetch expiresAt, then updateMany) is used
 * instead of a single blind updateMany, since the default expiry
 * calculation depends on whether the employer already set one — the
 * updateMany's own WHERE clause (status = pending_review) still carries
 * the entire concurrency guarantee described above; the extra read
 * before it does not weaken that.
 */
export async function autoApproveJob(jobId: string): Promise<AutoApproveResult> {
  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    select: { expiresAt: true },
  });

  const postedAt = new Date();
  const expiresAt = existing?.expiresAt ?? new Date(postedAt.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.job.updateMany({
    where: { id: jobId, status: "pending_review", deletedAt: null },
    data: { status: "active", postedAt, expiresAt },
  });

  if (result.count === 0) {
    return { success: false, reason: "not_eligible" };
  }

  // Same fix as the human-admin path (src/services/admin/moderateJob.ts's
  // approveJob) and for the same reason: /jobs and / are fully static
  // and would otherwise keep showing this job as absent until the next
  // deployment. Only runs after result.count confirms this specific call
  // actually won the race and changed the row — never before the update
  // succeeds. The country listing and job-detail page need no
  // revalidation here either, for the same reason documented there.
  revalidatePath("/jobs");
  revalidatePath("/");

  return { success: true };
}

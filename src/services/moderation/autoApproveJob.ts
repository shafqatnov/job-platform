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
 * active, postedAt -> now, expiresAt -> +LISTING_DURATION_DAYS, per
 * docs/18) via a single conditional updateMany, not a read-then-write —
 * this is the actual concurrency guarantee: the WHERE clause requires
 * status = pending_review, so two overlapping pipeline runs (or a
 * pipeline run racing a human admin's decision) can never both "win"
 * the same job. Whichever update lands first flips the status, and the
 * other's WHERE clause no longer matches.
 */
export async function autoApproveJob(jobId: string): Promise<AutoApproveResult> {
  const postedAt = new Date();
  const expiresAt = new Date(postedAt.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.job.updateMany({
    where: { id: jobId, status: "pending_review", deletedAt: null },
    data: { status: "active", postedAt, expiresAt },
  });

  if (result.count === 0) {
    return { success: false, reason: "not_eligible" };
  }

  return { success: true };
}

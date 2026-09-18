import { prisma } from "@/lib/prisma";
import { LISTING_DURATION_DAYS } from "@/constants/jobLifecycle";

export type ModerateJobResult = { success: true } | { success: false; error: string };

/**
 * Approves a pending job: status -> active, postedAt set to now,
 * expiresAt set per docs/18's documented 30-day default — never
 * invented, never left for the employer to set. Logs a ModerationAction
 * for auditability (docs/17's "moderation actions are logged"
 * recommendation).
 *
 * Only ever transitions a job that is currently pending_review — an
 * already-decided job (active/rejected/expired/closed) is left alone
 * and reported back as a safe error rather than silently reprocessed,
 * which matters if two admins act on the same queue concurrently.
 */
export async function approveJob(adminUserId: string, jobId: string): Promise<ModerateJobResult> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, deletedAt: true },
    });

    if (!job || job.deletedAt) {
      return { success: false, error: "Job not found." };
    }
    if (job.status !== "pending_review") {
      return { success: false, error: "This job is no longer pending review." };
    }

    const postedAt = new Date();
    const expiresAt = new Date(postedAt.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { status: "active", postedAt, expiresAt },
      }),
      prisma.moderationAction.create({
        data: { adminUserId, targetJobId: jobId, action: "approve" },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("approveJob failed", error);
    return { success: false, error: "We couldn't approve this job right now. Please try again." };
  }
}

/**
 * Rejects a pending job: status -> rejected, with an optional reason
 * stored on the job itself (docs/18: rejected jobs stay "visible only to
 * the submitting employer, with a reason") and logged as a
 * ModerationAction. The row is never deleted — auditability, per
 * docs/11-security-principles.md.
 */
export async function rejectJob(
  adminUserId: string,
  jobId: string,
  reason: string
): Promise<ModerateJobResult> {
  const trimmedReason = reason.trim() || null;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, deletedAt: true },
    });

    if (!job || job.deletedAt) {
      return { success: false, error: "Job not found." };
    }
    if (job.status !== "pending_review") {
      return { success: false, error: "This job is no longer pending review." };
    }

    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { status: "rejected", rejectionReason: trimmedReason },
      }),
      prisma.moderationAction.create({
        data: { adminUserId, targetJobId: jobId, action: "reject", reason: trimmedReason },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("rejectJob failed", error);
    return { success: false, error: "We couldn't reject this job right now. Please try again." };
  }
}

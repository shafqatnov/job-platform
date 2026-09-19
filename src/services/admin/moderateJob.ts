import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LISTING_DURATION_DAYS } from "@/constants/jobLifecycle";

export type ModerateJobResult = { success: true } | { success: false; error: string };

/**
 * Approves a pending job: status -> active, postedAt set to now.
 * expiresAt follows docs/18's documented 30-day default UNLESS the
 * employer already requested a specific expiry at submission time
 * (Version 1.1's optional expiry field, src/services/jobs/createJob.ts)
 * — that value is preserved as-is here rather than overwritten, so the
 * employer's own choice actually takes effect once the job goes live.
 * Logs a ModerationAction for auditability (docs/17's "moderation
 * actions are logged" recommendation).
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
      select: { status: true, deletedAt: true, expiresAt: true },
    });

    if (!job || job.deletedAt) {
      return { success: false, error: "Job not found." };
    }
    if (job.status !== "pending_review") {
      return { success: false, error: "This job is no longer pending review." };
    }

    const postedAt = new Date();
    const expiresAt = job.expiresAt ?? new Date(postedAt.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { status: "active", postedAt, expiresAt },
      }),
      prisma.moderationAction.create({
        data: { adminUserId, targetJobId: jobId, action: "approve" },
      }),
    ]);

    // Only after the transaction has actually committed: this job is now
    // publicly visible, but /jobs and / are fully static (no dynamic
    // API/segment forces server rendering, per their build output) and
    // are otherwise only regenerated on the next deployment. Without
    // this, a newly-approved job would be correctly stored as active yet
    // stay invisible on both pages until a redeploy. The country-specific
    // listing (/[country]/jobs) and job-detail page
    // (/[country]/jobs/[slug]) are NOT revalidated here because they are
    // already server-rendered on every request (their dynamic route
    // segment has no generateStaticParams, so Next.js never prerenders
    // them) — they already reflect this change with no action needed.
    revalidatePath("/jobs");
    revalidatePath("/");

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

/**
 * Admin equivalent of src/services/jobs/closeJob.ts — no company
 * ownership restriction (admin manages any job), and additionally logs
 * a ModerationAction for auditability, matching approveJob/rejectJob's
 * existing convention. Same active -> closed transition; existing
 * public-visibility rules already exclude anything not status = active.
 */
export async function closeJobAsAdmin(adminUserId: string, jobId: string): Promise<ModerateJobResult> {
  try {
    const result = await prisma.job.updateMany({
      where: { id: jobId, status: "active", deletedAt: null },
      data: { status: "closed", closedAt: new Date() },
    });

    if (result.count === 0) {
      return { success: false, error: "This job cannot be closed from its current state." };
    }

    await prisma.moderationAction.create({
      data: { adminUserId, targetJobId: jobId, action: "close" },
    });

    revalidatePath("/jobs");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("closeJobAsAdmin failed", error);
    return { success: false, error: "We couldn't close this job right now. Please try again." };
  }
}

/**
 * Admin equivalent of src/services/jobs/reopenJob.ts — same safety
 * rules (only from `closed`, only when expiresAt is null or still in
 * the future; see reopenJob.ts for why `expired`/`rejected` are never
 * reopenable this way), no company ownership restriction, plus a
 * ModerationAction audit entry.
 */
export async function reopenJobAsAdmin(adminUserId: string, jobId: string): Promise<ModerateJobResult> {
  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
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
      where: { id: jobId, status: "closed", deletedAt: null },
      data: { status: "active", closedAt: null },
    });

    if (result.count === 0) {
      return { success: false, error: "This job cannot be reopened from its current state." };
    }

    await prisma.moderationAction.create({
      data: { adminUserId, targetJobId: jobId, action: "reopen" },
    });

    revalidatePath("/jobs");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("reopenJobAsAdmin failed", error);
    return { success: false, error: "We couldn't reopen this job right now. Please try again." };
  }
}

/**
 * Admin equivalent of src/services/jobs/deleteJob.ts — same soft-delete
 * mechanism (Job.deletedAt = now(), reusing the field every read path
 * already filters on, never a raw row DELETE) and the same dependent-
 * data safety rule (blocked if the job has any Application or SavedJob
 * row). Part 8 of this task requires admin hard-delete to still respect
 * dependent-data safety, and no established policy exists anywhere in
 * this codebase for deleting Application/SavedJob history — so admin
 * gets no special bypass here, only a wider reach (any job, not just
 * one company's) plus a ModerationAction audit entry. The audit entry
 * remains fully meaningful afterward: ModerationAction.targetJobId only
 * turns null if the Job ROW itself is ever removed, which soft-delete
 * never does.
 */
export async function deleteJobAsAdmin(adminUserId: string, jobId: string): Promise<ModerateJobResult> {
  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, deletedAt: null },
      select: {
        id: true,
        _count: { select: { applications: { where: { deletedAt: null } }, savedBy: true } },
      },
    });

    if (!job) {
      return { success: false, error: "Job not found." };
    }
    if (job._count.applications > 0 || job._count.savedBy > 0) {
      return {
        success: false,
        error: "This job cannot be permanently deleted because it has associated application data. You can close the job instead.",
      };
    }

    await prisma.$transaction([
      prisma.job.update({ where: { id: jobId }, data: { deletedAt: new Date() } }),
      prisma.moderationAction.create({
        data: { adminUserId, targetJobId: jobId, action: "delete" },
      }),
    ]);

    revalidatePath("/jobs");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("deleteJobAsAdmin failed", error);
    return { success: false, error: "We couldn't delete this job right now. Please try again." };
  }
}

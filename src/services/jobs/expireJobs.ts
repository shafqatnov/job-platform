import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ExpireJobsResult = {
  expiredCount: number;
};

/**
 * The documented `active -> expired` automated background task
 * (docs/09-automation-architecture.md, docs/18-job-lifecycle.md):
 * transitions every job whose listing has passed its `expiresAt` while
 * still `status = active`.
 *
 * A single conditional `updateMany` — not a fetch-then-update-one-by-one
 * loop — so the WHERE clause itself is the entire concurrency/idempotency
 * mechanism: it only ever matches rows that are currently `active`, not
 * soft-deleted, and past a real (non-null) `expiresAt`. Running this
 * twice in a row, or two overlapping invocations, cannot double-process
 * a job or revert a newer status — a job already `expired`,
 * `pending_review`, `rejected`, or `closed` simply never matches the
 * predicate again, and Postgres's row-level locking makes the update
 * itself atomic across concurrent callers.
 *
 * No ModerationAction row is written here: that model's `adminUserId`
 * is a required human-admin reference (see prisma/schema.prisma) for
 * docs/17's *admin* moderation actions (approve/reject) — an automated
 * system transition has no admin and is a documented, distinct concept
 * (docs/09), so inventing a system-actor audit entry here would not be
 * backed by any documented requirement.
 */
export async function expireDueJobs(): Promise<ExpireJobsResult> {
  const result = await prisma.job.updateMany({
    where: {
      status: "active",
      deletedAt: null,
      expiresAt: { not: null, lte: new Date() },
    },
    data: { status: "expired" },
  });

  // Same stale-static-page issue as approval, in reverse: /jobs and /
  // are fully static and would otherwise keep showing an expired job as
  // active until the next deployment. Only when at least one row
  // actually changed — an empty run has nothing to invalidate. The
  // country listing and per-job detail page need no revalidation: both
  // are already server-rendered on every request (no
  // generateStaticParams for their dynamic segments), so they already
  // reflect this the moment it happens, with no per-job data needed.
  if (result.count > 0) {
    revalidatePath("/jobs");
    revalidatePath("/");
  }

  return { expiredCount: result.count };
}

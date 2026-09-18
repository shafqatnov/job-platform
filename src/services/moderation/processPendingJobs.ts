import { prisma } from "@/lib/prisma";
import type { AiModerationProvider } from "@/services/ai/types";
import { resolveModerationProvider } from "@/services/ai/resolveModerationProvider";
import { moderateJobSubmission, type ModerationPipelineResult } from "@/services/moderation/moderateJobSubmission";

const DEFAULT_BATCH_LIMIT = 20;
const MAX_BATCH_LIMIT = 50;

export type ProcessPendingJobsSummary = {
  processed: number;
  autoApproved: number;
  sentToReview: number;
};

/**
 * The batch entry point a future scheduler/worker can call safely (see
 * docs/09-automation-architecture.md — no queue/cron is assumed or
 * built here, only the invokable unit of work itself, mirroring
 * src/services/jobs/expireJobs.ts's own shape). Only ever selects
 * `pending_review` jobs — an already-active job is never even fetched,
 * and moderateJobSubmission's own atomic autoApproveJob update is a
 * second, independent layer of protection against a race between two
 * overlapping calls to this function.
 *
 * Bounded by `limit` (default 20, hard cap 50) so one invocation always
 * does a small, predictable amount of work — consistent with docs/09's
 * "simple, independent scheduled/triggered tasks" principle.
 */
export async function processPendingJobs(
  limit: number = DEFAULT_BATCH_LIMIT,
  provider: AiModerationProvider = resolveModerationProvider()
): Promise<ProcessPendingJobsSummary> {
  const boundedLimit = Math.min(Math.max(1, limit), MAX_BATCH_LIMIT);

  const pendingJobs = await prisma.job.findMany({
    where: { status: "pending_review", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: boundedLimit,
  });

  let autoApproved = 0;
  let sentToReview = 0;

  for (const job of pendingJobs) {
    const result = await moderateJobSubmission(job.id, provider);
    logModerationResult(result);
    if (result.outcome === "auto_approved") {
      autoApproved += 1;
    } else {
      sentToReview += 1;
    }
  }

  return { processed: pendingJobs.length, autoApproved, sentToReview };
}

/**
 * Structured, safe logging only — job ID, decision, source type,
 * duration, reason codes. Never logs title/description content, AI
 * explanation text, or any credential/secret.
 */
function logModerationResult(result: ModerationPipelineResult): void {
  console.log(
    JSON.stringify({
      event: "ai_moderation_pipeline_result",
      jobId: result.jobId,
      outcome: result.outcome,
      reasonCodes: result.reasonCodes,
      duplicateLevel: result.duplicateAnalysis?.level ?? null,
      aiProvider: result.aiProviderName,
      aiFailureReason: result.aiResult && !result.aiResult.ok ? result.aiResult.failureReason : null,
      durationMs: result.durationMs,
      processedAt: result.processedAt,
    })
  );
}

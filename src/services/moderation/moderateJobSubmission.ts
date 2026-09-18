import type { AiModerationProvider, AiProviderResult, ModerationReasonCode } from "@/services/ai/types";
import { resolveModerationProvider } from "@/services/ai/resolveModerationProvider";
import {
  runDeterministicGates,
  type DeterministicGateFailureCode,
} from "@/services/moderation/deterministicGates";
import { analyzeDuplicates, type DuplicateAnalysisResult } from "@/services/moderation/duplicateDetection";
import { autoApproveJob } from "@/services/moderation/autoApproveJob";
import { isEligibleForAutoPublish } from "@/services/moderation/policy";

export type ModerationOutcome = "auto_approved" | "sent_to_review";

export type ModerationPipelineResult = {
  jobId: string;
  outcome: ModerationOutcome;
  reasonCodes: ModerationReasonCode[];
  deterministicFailures: DeterministicGateFailureCode[];
  duplicateAnalysis: DuplicateAnalysisResult | null;
  aiResult: AiProviderResult | null;
  aiProviderName: string;
  processedAt: string;
  durationMs: number;
};

/** Configurable via env — no I/O call should hang the pipeline indefinitely. */
const DEFAULT_AI_TIMEOUT_MS = 15000;

function resolveAiTimeoutMs(): number {
  const raw = process.env.AI_MODERATION_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_TIMEOUT_MS;
}

async function callProviderWithTimeout(
  provider: AiModerationProvider,
  input: Parameters<AiModerationProvider["moderateJob"]>[0],
  timeoutMs: number
): Promise<AiProviderResult> {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<AiProviderResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ ok: false, failureReason: "timeout", detail: `Provider did not respond within ${timeoutMs}ms.` });
    }, timeoutMs);
  });

  try {
    return await Promise.race([provider.moderateJob(input), timeoutPromise]);
  } catch (error) {
    return {
      ok: false,
      failureReason: "unavailable",
      detail: error instanceof Error ? error.message : "Provider threw an unexpected error.",
    };
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

const GATE_FAILURE_REASON_CODES: Record<DeterministicGateFailureCode, ModerationReasonCode> = {
  not_found: "other",
  not_pending: "other",
  soft_deleted: "other",
  missing_title: "insufficient_data",
  missing_description: "insufficient_data",
  missing_company: "invalid_company",
  missing_country: "invalid_location",
  missing_city: "invalid_location",
  missing_category: "insufficient_data",
  invalid_application_method: "malformed_application_target",
  missing_external_url: "malformed_application_target",
  unsafe_external_url: "malformed_application_target",
  already_expired: "expired",
  employer_account_not_active: "invalid_company",
  source_not_authorized: "source_not_authorized",
};

function mapGateFailures(failures: DeterministicGateFailureCode[]): ModerationReasonCode[] {
  const codes = new Set<ModerationReasonCode>();
  for (const failure of failures) {
    codes.add(GATE_FAILURE_REASON_CODES[failure]);
  }
  return codes.size > 0 ? Array.from(codes) : ["other"];
}

/**
 * The full moderation pipeline for ONE job, run in the documented order:
 * deterministic gates -> duplicate detection -> AI analysis -> policy
 * decision. Every stage can independently route the job to review; only
 * a job that clears every stage AND satisfies isEligibleForAutoPublish
 * is ever auto-published, and even then via autoApproveJob's own atomic
 * conditional update (safe under concurrent/duplicate invocation).
 *
 * The automated pipeline never auto-rejects (see autoApproveJob.ts) —
 * every non-approved outcome leaves the job exactly where it already
 * was (pending_review, the existing, real lifecycle state — no new
 * status is invented). A human admin's existing approve/reject actions
 * are completely unaffected by this function.
 *
 * `provider` defaults to resolveModerationProvider() — the honest
 * "not configured" adapter unless both OPENAI_API_KEY and the explicit
 * AI_MODERATION_PROVIDER="openai" opt-in are set (see
 * resolveModerationProvider.ts). Pass a real provider (or, in tests
 * only, a mock implementing the same interface) to override that.
 */
export async function moderateJobSubmission(
  jobId: string,
  provider: AiModerationProvider = resolveModerationProvider()
): Promise<ModerationPipelineResult> {
  const startedAt = Date.now();

  function finish(
    partial: Omit<ModerationPipelineResult, "jobId" | "aiProviderName" | "processedAt" | "durationMs">
  ): ModerationPipelineResult {
    return {
      jobId,
      aiProviderName: provider.name,
      processedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      ...partial,
    };
  }

  const gateResult = await runDeterministicGates(jobId);
  if (!gateResult.passed || !gateResult.job) {
    return finish({
      outcome: "sent_to_review",
      reasonCodes: mapGateFailures(gateResult.failures),
      deterministicFailures: gateResult.failures,
      duplicateAnalysis: null,
      aiResult: null,
    });
  }
  const job = gateResult.job;

  const duplicateAnalysis = await analyzeDuplicates({
    id: job.id,
    title: job.title,
    companyId: job.companyId,
    countryId: job.countryId,
    cityId: job.cityId,
  });

  if (duplicateAnalysis.level === "likely_duplicate") {
    return finish({
      outcome: "sent_to_review",
      reasonCodes: ["duplicate"],
      deterministicFailures: [],
      duplicateAnalysis,
      aiResult: null,
    });
  }

  const aiResult = await callProviderWithTimeout(
    provider,
    {
      jobId: job.id,
      title: job.title,
      description: job.description,
      companyName: job.companyName,
      countryName: job.countryName,
      cityName: job.cityName,
      categoryName: job.categoryName,
      applicationMethod: job.applicationMethod,
      externalApplicationUrl: job.externalApplicationUrl ?? undefined,
    },
    resolveAiTimeoutMs()
  );

  if (!aiResult.ok) {
    return finish({
      outcome: "sent_to_review",
      reasonCodes: ["other"],
      deterministicFailures: [],
      duplicateAnalysis,
      aiResult,
    });
  }

  const eligible = isEligibleForAutoPublish({ duplicateLevel: duplicateAnalysis.level, aiOutput: aiResult.output });

  if (eligible) {
    const approveResult = await autoApproveJob(jobId);
    if (approveResult.success) {
      return finish({
        outcome: "auto_approved",
        reasonCodes: [],
        deterministicFailures: [],
        duplicateAnalysis,
        aiResult,
      });
    }
    // Lost a race (another process already changed this job's status) —
    // nothing was corrupted; correctly report it as no longer actionable.
    return finish({
      outcome: "sent_to_review",
      reasonCodes: ["other"],
      deterministicFailures: [],
      duplicateAnalysis,
      aiResult,
    });
  }

  return finish({
    outcome: "sent_to_review",
    reasonCodes: aiResult.output.reasonCodes.length > 0 ? aiResult.output.reasonCodes : ["other"],
    deterministicFailures: [],
    duplicateAnalysis,
    aiResult,
  });
}

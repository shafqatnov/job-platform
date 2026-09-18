import type { AiJobModerationOutput, ModerationReasonCode } from "@/services/ai/types";
import type { DuplicateMatchLevel } from "@/services/moderation/duplicateDetection";

/**
 * Reason codes that block auto-publish even when the AI's own decision
 * was "approve" — a defensive contradiction check, since a model can be
 * wrong or internally inconsistent. This set is the "configurable
 * decision policy" surface this task asks for: it can be tuned (e.g.
 * per-country, per-category) without touching the pipeline
 * orchestration in moderateJobSubmission.ts.
 *
 * Deliberately NOT a numeric confidence threshold (e.g. "score >= 90 ->
 * publish") — no accuracy figure for any AI provider has been measured
 * against a labeled evaluation set for this project, so no such number
 * would be honest. See this task's final report.
 */
export const DEFAULT_HARD_SAFETY_FLAGS: ReadonlySet<ModerationReasonCode> = new Set([
  "prohibited_content",
  "source_not_authorized",
  "malformed_application_target",
  "duplicate",
]);

export type AutoPublishPolicyInput = {
  duplicateLevel: DuplicateMatchLevel;
  aiOutput: AiJobModerationOutput;
};

/**
 * The auto-publish eligibility rule, isolated as a pure function
 * (no I/O) precisely so it can be unit-tested on its own and swapped
 * later without touching orchestration. All of these must hold:
 *  - duplicate analysis is not "likely_duplicate"
 *  - the AI's own decision is "approve"
 *  - the AI did not itself flag the job as a suspected duplicate
 *  - none of the AI's reason codes are in the hard-safety-flag set
 *
 * This is deliberately conservative: an AI "approve" is necessary but
 * never sufficient on its own (this task's explicit "do NOT simply let
 * an LLM decide publish based on one prompt" requirement).
 */
export function isEligibleForAutoPublish(
  input: AutoPublishPolicyInput,
  hardSafetyFlags: ReadonlySet<ModerationReasonCode> = DEFAULT_HARD_SAFETY_FLAGS
): boolean {
  if (input.duplicateLevel === "likely_duplicate") {
    return false;
  }
  if (input.aiOutput.decision !== "approve") {
    return false;
  }
  if (input.aiOutput.suspectedDuplicate) {
    return false;
  }
  if (input.aiOutput.reasonCodes.some((code) => hardSafetyFlags.has(code))) {
    return false;
  }
  return true;
}

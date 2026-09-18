import type { AiModerationProvider } from "@/services/ai/types";
import { unavailableAiProvider } from "@/services/ai/unavailableAiProvider";
import { openAiModerationProvider } from "@/services/ai/openAiModerationProvider";

/**
 * The real default-provider resolution used by the production pipeline
 * (processPendingJobs.ts, moderateJobSubmission.ts's default parameter,
 * and therefore the /api/moderation/process-pending-jobs trigger route).
 *
 * Two independent conditions must BOTH be true before real AI
 * processing is ever used: OPENAI_API_KEY must be configured, AND
 * AI_MODERATION_PROVIDER must be explicitly set to "openai". This is
 * deliberate: an operator adding OPENAI_API_KEY for an unrelated reason
 * (or a future feature) must never silently flip this pipeline into
 * live, uncontrolled automatic job processing. Enabling real
 * auto-publish requires a second, explicit, purpose-specific decision.
 */
export function resolveModerationProvider(): AiModerationProvider {
  const explicitlyEnabled = process.env.AI_MODERATION_PROVIDER === "openai";
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  if (explicitlyEnabled && hasApiKey) {
    return openAiModerationProvider;
  }

  return unavailableAiProvider;
}

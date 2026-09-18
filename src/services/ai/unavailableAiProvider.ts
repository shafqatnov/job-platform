import type { AiJobModerationInput, AiModerationProvider, AiProviderResult } from "@/services/ai/types";

/**
 * The real, production default AI provider — used because no AI vendor
 * has actually been selected or configured for this project yet
 * (docs/08-ai-architecture.md explicitly defers "choice of AI
 * provider(s)/models" to Phase 2, and no provider package or API key
 * exists anywhere in this codebase or .env).
 *
 * This is NOT a mock and NOT a fake AI response: it makes no claim
 * about job content at all. It always and only reports that AI
 * moderation is unavailable, which is the honest, correct answer given
 * the current configuration — and it is exactly the condition the
 * moderation pipeline's fail-safe path is built to handle (AI
 * unavailable -> route to review, never auto-publish).
 *
 * When a real provider is selected and configured (see this task's
 * report for the provider-decision recommendation), a new adapter
 * implementing AiModerationProvider should replace this as the default
 * — the pipeline itself needs no changes, since it only depends on the
 * interface.
 */
export const unavailableAiProvider: AiModerationProvider = {
  name: "unconfigured",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async moderateJob(_input: AiJobModerationInput): Promise<AiProviderResult> {
    return {
      ok: false,
      failureReason: "unavailable",
      detail: "No AI moderation provider is configured for this environment.",
    };
  },
};

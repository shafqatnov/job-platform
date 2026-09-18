import type { AiJobModerationInput, AiModerationProvider, AiProviderResult } from "@/services/ai/types";

/**
 * A mock AI provider for automated tests ONLY — per this task's explicit
 * rule, this must never be imported or used by real production
 * moderation execution (src/services/moderation/*.ts and the
 * /api/moderation/process-pending-jobs route always default to
 * unavailableAiProvider, never this file). It lives under
 * src/test-utils specifically so that's obvious from its location.
 */
export function createMockAiProvider(result: AiProviderResult): AiModerationProvider {
  return {
    name: "mock-test-provider",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async moderateJob(_input: AiJobModerationInput): Promise<AiProviderResult> {
      return result;
    },
  };
}

/** A mock provider that never resolves within any reasonable test timeout, to exercise the pipeline's own timeout handling. */
export function createHangingAiProvider(): AiModerationProvider {
  return {
    name: "mock-hanging-provider",
    moderateJob(): Promise<AiProviderResult> {
      return new Promise(() => {
        /* never resolves */
      });
    },
  };
}

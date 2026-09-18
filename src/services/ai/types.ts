/**
 * The AI moderation provider contract (docs/08-ai-architecture.md's
 * "AI capability must not be tightly coupled to UI code... accessed
 * through a dedicated AI module/adapter with an explicit input/output
 * contract"). Any real provider (OpenAI, Anthropic, Gemini, etc.) — or
 * the deliberately honest "not configured" default in
 * unavailableAiProvider.ts — implements this same interface, so the
 * moderation pipeline never depends on a specific vendor.
 */

export type AiJobModerationInput = {
  jobId: string;
  title: string;
  description: string;
  companyName: string;
  countryName: string;
  cityName: string;
  categoryName: string;
  applicationMethod: "on_platform" | "external_url";
  externalApplicationUrl?: string;
};

/**
 * Structured reason codes — the model must return one of these, never
 * free text used as a database command. Matches this task's required
 * minimum set exactly; no invented codes.
 */
export type ModerationReasonCode =
  | "duplicate"
  | "suspicious"
  | "insufficient_data"
  | "invalid_location"
  | "invalid_company"
  | "expired"
  | "prohibited_content"
  | "source_not_authorized"
  | "malformed_application_target"
  | "other";

export type AiModerationDecision = "approve" | "review" | "reject";

export type AiJobModerationOutput = {
  decision: AiModerationDecision;
  reasonCodes: ModerationReasonCode[];
  /** Short human-readable rationale for the admin — never executed, never trusted as a command. */
  explanation: string;
  suspectedDuplicate: boolean;
};

export type AiProviderFailureReason =
  | "unavailable"
  | "timeout"
  | "malformed_response"
  | "unsupported_decision";

export type AiProviderResult =
  | { ok: true; output: AiJobModerationOutput }
  | { ok: false; failureReason: AiProviderFailureReason; detail: string };

export interface AiModerationProvider {
  readonly name: string;
  moderateJob(input: AiJobModerationInput): Promise<AiProviderResult>;
}

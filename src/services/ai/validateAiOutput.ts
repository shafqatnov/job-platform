import type { AiModerationDecision, AiProviderResult, ModerationReasonCode } from "@/services/ai/types";

/**
 * Exported so any real provider adapter (e.g. openAiModerationProvider.ts)
 * can build its Structured Output JSON Schema `enum` from the exact same
 * source of truth as this runtime validator — one allowlist, never two
 * that could drift apart.
 */
export const VALID_DECISIONS: ReadonlySet<string> = new Set(["approve", "review", "reject"]);

export const VALID_REASON_CODES: ReadonlySet<string> = new Set([
  "duplicate",
  "suspicious",
  "insufficient_data",
  "invalid_location",
  "invalid_company",
  "expired",
  "prohibited_content",
  "source_not_authorized",
  "malformed_application_target",
  "other",
]);

const MAX_EXPLANATION_LENGTH = 2000;

/**
 * Validates a raw AI provider response into a trusted
 * AiJobModerationOutput — or a structured failure. This is the ONLY
 * place raw model output is trusted; nothing downstream ever inspects
 * unvalidated model text, and free-form output can never reach the
 * database as a command (it is only ever compared against fixed enum
 * allowlists here). Any real provider adapter must route its response
 * through this function before the pipeline sees it.
 */
export function validateAiModerationOutput(raw: unknown): AiProviderResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, failureReason: "malformed_response", detail: "Response was not a JSON object." };
  }

  const candidate = raw as Record<string, unknown>;

  const decision = candidate.decision;
  if (typeof decision !== "string" || !VALID_DECISIONS.has(decision)) {
    return {
      ok: false,
      failureReason: "unsupported_decision",
      detail: `decision must be one of approve/review/reject, got: ${JSON.stringify(decision)}`,
    };
  }

  const reasonCodesRaw = candidate.reasonCodes;
  if (
    !Array.isArray(reasonCodesRaw) ||
    !reasonCodesRaw.every((code) => typeof code === "string" && VALID_REASON_CODES.has(code))
  ) {
    return {
      ok: false,
      failureReason: "malformed_response",
      detail: "reasonCodes must be an array of known reason codes.",
    };
  }

  const explanation = candidate.explanation;
  if (typeof explanation !== "string") {
    return { ok: false, failureReason: "malformed_response", detail: "explanation must be a string." };
  }

  const suspectedDuplicate = candidate.suspectedDuplicate;
  if (typeof suspectedDuplicate !== "boolean") {
    return { ok: false, failureReason: "malformed_response", detail: "suspectedDuplicate must be a boolean." };
  }

  return {
    ok: true,
    output: {
      decision: decision as AiModerationDecision,
      reasonCodes: reasonCodesRaw as ModerationReasonCode[],
      explanation: explanation.slice(0, MAX_EXPLANATION_LENGTH),
      suspectedDuplicate,
    },
  };
}

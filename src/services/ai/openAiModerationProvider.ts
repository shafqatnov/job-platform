import OpenAI, { APIConnectionTimeoutError } from "openai";
import type { AiJobModerationInput, AiModerationProvider, AiProviderResult } from "@/services/ai/types";
import { validateAiModerationOutput, VALID_DECISIONS, VALID_REASON_CODES } from "@/services/ai/validateAiOutput";

/**
 * The real OpenAI-backed AI moderation provider — implements the exact
 * same AiModerationProvider interface as unavailableAiProvider.ts, so
 * the pipeline (moderateJobSubmission.ts) needs no changes at all to
 * use this instead.
 *
 * Model choice: the exact model requested for this integration
 * ("gpt-5.6-luna"), overridable via OPENAI_MODERATION_MODEL. This
 * codebase has no way to independently verify that model ID against
 * OpenAI's real catalog (no live API key was available while writing
 * this file — see this task's final report). If the model ID is wrong
 * or retired, the API call fails with a normal APIError, which this
 * provider already maps to a safe "unavailable" result — it can never
 * cause an incorrect auto-publish.
 *
 * Uses the Responses API with Structured Outputs (strict JSON Schema)
 * so the model can only ever return the exact shape
 * AiJobModerationOutput expects — never free-form text trusted as a
 * command. The raw response is still passed through
 * validateAiModerationOutput before anything downstream sees it.
 *
 * No tools are enabled on this request (no web search, no browsing,
 * no function calling) — the model only ever sees the job fields given
 * to it and cannot fetch anything else.
 */

const DEFAULT_MODEL = "gpt-5.6-luna";

// Conservative and bounded: the pipeline's own outer timeout
// (AI_MODERATION_TIMEOUT_MS, default 15s in moderateJobSubmission.ts)
// is the hard backstop regardless; these client-level settings just
// make sure a single OpenAI request also fails fast and predictably,
// and that a transient error doesn't multiply cost via aggressive
// retries.
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

const RESPONSE_FORMAT_NAME = "job_moderation_result";

/**
 * Hand-written JSON Schema (no zod dependency) built from the exact
 * same reason-code/decision allowlists validateAiOutput.ts uses at
 * runtime — one source of truth, so the schema the model is
 * constrained to and the validator that re-checks its output can never
 * drift apart. Matches OpenAI's strict-mode subset of JSON Schema
 * (every property required, additionalProperties: false).
 */
const JOB_MODERATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: Array.from(VALID_DECISIONS) },
    reasonCodes: {
      type: "array",
      items: { type: "string", enum: Array.from(VALID_REASON_CODES) },
    },
    explanation: { type: "string" },
    suspectedDuplicate: { type: "boolean" },
  },
  required: ["decision", "reasonCodes", "explanation", "suspectedDuplicate"],
  additionalProperties: false,
} as const;

const SYSTEM_INSTRUCTIONS = `You are a content-moderation assistant for a job listing platform. You will be given the structured fields of ONE employer-submitted job listing. Assess it and return ONLY the required structured fields.

Your assessment must cover:
- Legitimacy: does this describe a real, plausible employment opportunity (not a scam, MLM, or fake listing)?
- Title/description consistency: does the description actually match and support the stated title?
- Category consistency: is the stated category a reasonable fit for the role described?
- Location consistency: is the stated city/country consistent with the role as described (no unexplained contradiction)?
- Application target relevance: if an external application URL is provided, does it appear to plausibly belong to the employer/role rather than being unrelated or suspicious?
- Spam/suspicious indicators: excessive urgency, unrealistic pay claims, requests for upfront payment, generic templated filler text, or other spam patterns.
- Missing critical information: is anything essential (a real job duty, meaningful description content) absent?
- Duplicate suspicion: based ONLY on this listing's own text, does it read like a generic template or repost rather than an original posting? (You are not shown other listings — do not assume access to any database.)

Rules:
- Use "approve" only when the listing is clearly legitimate, internally consistent, and shows no concerning signal.
- Use "review" whenever you are uncertain, or a signal is ambiguous rather than clearly disqualifying.
- Use "reject" only for a listing that is clearly illegitimate or prohibited.
- Never invent information not present in the supplied fields.
- Do not assess or reference anything outside the fields you were given — you have no access to the internet, other listings, or any database.`;

function buildUserInput(input: AiJobModerationInput): string {
  const lines = [
    `Title: ${input.title}`,
    `Category: ${input.categoryName}`,
    `Location: ${input.cityName}, ${input.countryName}`,
    `Company: ${input.companyName}`,
    `Application method: ${input.applicationMethod}`,
  ];
  if (input.applicationMethod === "external_url" && input.externalApplicationUrl) {
    lines.push(`External application URL: ${input.externalApplicationUrl}`);
  }
  lines.push("", "Description:", input.description);
  return lines.join("\n");
}

/** Strips anything resembling an OpenAI API key from error text before it is ever logged or returned. */
function sanitizeErrorDetail(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]");
}

function createClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

export const openAiModerationProvider: AiModerationProvider = {
  name: "openai",

  async moderateJob(input: AiJobModerationInput): Promise<AiProviderResult> {
    const client = createClient();
    if (!client) {
      return {
        ok: false,
        failureReason: "unavailable",
        detail: "OPENAI_API_KEY is not configured for this environment.",
      };
    }

    const model = process.env.OPENAI_MODERATION_MODEL || DEFAULT_MODEL;

    let response;
    try {
      response = await client.responses.create({
        model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: buildUserInput(input),
        text: {
          format: {
            type: "json_schema",
            name: RESPONSE_FORMAT_NAME,
            strict: true,
            schema: JOB_MODERATION_JSON_SCHEMA,
          },
        },
      });
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        return { ok: false, failureReason: "timeout", detail: `Request exceeded ${REQUEST_TIMEOUT_MS}ms.` };
      }
      const message = error instanceof Error ? error.message : "Unknown error calling the AI provider.";
      return { ok: false, failureReason: "unavailable", detail: sanitizeErrorDetail(message) };
    }

    if (response.status !== "completed" || !response.output_text) {
      return {
        ok: false,
        failureReason: "malformed_response",
        detail: `Response did not complete with usable text output (status: ${response.status ?? "unknown"}).`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      return { ok: false, failureReason: "malformed_response", detail: "Response text was not valid JSON." };
    }

    return validateAiModerationOutput(parsed);
  },
};

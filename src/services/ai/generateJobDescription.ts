import OpenAI, { APIConnectionTimeoutError } from "openai";

/**
 * Server-only AI assist for the employer job-posting form's optional
 * "Generate with AI" action — a distinct capability from
 * openAiModerationProvider.ts (that's automated content moderation with
 * a structured-JSON contract; this is a plain-text drafting assistant
 * the EMPLOYER explicitly triggers and reviews before use). Mirrors that
 * file's client setup/timeout/error-sanitization conventions for
 * consistency, since it's the only other place in this codebase that
 * calls OpenAI.
 */

export type GenerateJobDescriptionInput = {
  title: string;
  countryName?: string | null;
  cityName?: string | null;
  categoryName?: string | null;
  /** The employer's own in-progress draft, if any — improved upon, never contradicted. */
  existingDescription?: string;
  salaryMin?: number;
  salaryMax?: number;
  currencyCode?: string;
  applicationMethod?: "on_platform" | "external_url";
};

export type GenerateJobDescriptionResult = { ok: true; description: string } | { ok: false; error: string };

// Matches createJob.ts's own MAX_TITLE_LENGTH/MAX_DESCRIPTION_LENGTH —
// duplicated rather than imported since createJob.ts doesn't export
// them and this task's scope doesn't call for changing that file.
const MAX_TITLE_LENGTH = 200;
const MAX_EXISTING_DESCRIPTION_LENGTH = 10000;
const MAX_GENERATED_LENGTH = 10000;

const DEFAULT_MODEL = "gpt-5.6-luna";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

const GENERIC_ERROR = "We couldn't generate a description right now. Please try again or write one manually.";

/**
 * Fixed, server-controlled instruction — never influenced by client
 * input beyond the job fields themselves. No tools/browsing/function
 * calling are enabled, so the model can only ever work with what's
 * given here.
 */
const SYSTEM_INSTRUCTIONS = `You are an expert global recruitment copywriter helping an employer draft a professional job description for a job listings platform.

You will be given the job fields an employer has entered so far. Write a clear, professional, realistic job description using ONLY that information.

Structure the output as plain text with these sections, in this order:
1. Overview
2. Key Responsibilities
3. Required Qualifications
4. Preferred Skills/Experience — include this section ONLY if there is a genuine basis for it in the supplied information; otherwise omit it.

Strict rules:
- Never invent a salary, compensation figure, or benefit that was not explicitly supplied.
- Never invent or assume a company name, brand, or employer detail beyond what is given.
- Never invent or alter the stated location.
- Never claim visa sponsorship, relocation assistance, or any other benefit unless it was explicitly supplied.
- Never include discriminatory requirements (age, gender, marital status, religion, national origin, disability, or similar).
- Never make legal guarantees or exaggerated/unverifiable claims.
- Never include contact information, email addresses, or phone numbers.
- Do not use markdown tables. Plain text only — simple line breaks and dashes for lists are fine, but no markdown headers, no HTML.
- If information for a section is missing, write a brief, useful, generic section instead of fabricating facts.
- If an existing draft description is supplied, improve and expand on it — never contradict details it already states.`;

function buildUserInput(input: GenerateJobDescriptionInput): string {
  const lines = [`Job title: ${input.title}`];
  if (input.categoryName) lines.push(`Category: ${input.categoryName}`);
  const location = [input.cityName, input.countryName].filter(Boolean).join(", ");
  if (location) lines.push(`Location: ${location}`);
  if (input.salaryMin && input.salaryMax && input.currencyCode) {
    lines.push(`Salary range: ${input.currencyCode} ${input.salaryMin}–${input.salaryMax}`);
  }
  if (input.applicationMethod) {
    lines.push(`Application method: ${input.applicationMethod === "external_url" ? "external link" : "on-platform application"}`);
  }
  if (input.existingDescription) {
    lines.push("", "Existing draft description provided by the employer:", input.existingDescription);
  } else {
    lines.push("", "No existing description was provided — write one from scratch using only the fields above.");
  }
  return lines.join("\n");
}

/** Strips anything resembling an OpenAI API key from error text before it is ever logged. */
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

export async function generateJobDescription(input: GenerateJobDescriptionInput): Promise<GenerateJobDescriptionResult> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Enter a job title before generating a description." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "Job title is too long." };
  }
  if (input.existingDescription && input.existingDescription.length > MAX_EXISTING_DESCRIPTION_LENGTH) {
    return { ok: false, error: "Existing description is too long to use as context." };
  }

  const client = createClient();
  if (!client) {
    console.error("generateJobDescription: OPENAI_API_KEY is not configured for this environment.");
    return { ok: false, error: GENERIC_ERROR };
  }

  // OPENAI_MODEL is optional; the feature works with only OPENAI_API_KEY
  // configured, per this task's environment constraints.
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: buildUserInput({ ...input, title }),
    });
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) {
      console.error(`generateJobDescription timed out after ${REQUEST_TIMEOUT_MS}ms`);
      return { ok: false, error: GENERIC_ERROR };
    }
    const message = error instanceof Error ? error.message : "Unknown error calling the AI provider.";
    console.error("generateJobDescription failed:", sanitizeErrorDetail(message));
    return { ok: false, error: GENERIC_ERROR };
  }

  if (response.status !== "completed" || !response.output_text) {
    console.error(`generateJobDescription: response did not complete (status: ${response.status ?? "unknown"})`);
    return { ok: false, error: GENERIC_ERROR };
  }

  const description = response.output_text.trim().slice(0, MAX_GENERATED_LENGTH);
  if (!description) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, description };
}

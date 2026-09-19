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
  companyName?: string | null;
  countryName?: string | null;
  cityName?: string | null;
  categoryName?: string | null;
  /** The employer's own in-progress draft, if any — treated as authoritative context, never ignored or contradicted. */
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
const SYSTEM_INSTRUCTIONS = `You are an experienced HR recruiter and professional copywriter drafting a job description for a job listings platform.

Treat every employer-supplied field below as authoritative and final. You are drafting TEXT, not making decisions — never second-guess, reinterpret, or substitute any supplied value.

You will be given the employer's fields in this priority order: Company, Job title, Existing description (if any), Category, Country, City, Salary (if supplied), Application method (if relevant). Use the existing description as real context to build on — never ignore it, never contradict anything it states.

You MUST NEVER invent, assume, or infer any of the following beyond exactly what was supplied:
- Company name or any detail about the company
- Category (if a category was supplied, use that EXACT category — never substitute or infer a different one)
- Country or city
- Salary or any compensation figure
- Benefits of any kind
- Visa sponsorship or relocation assistance
- Remote/on-site/hybrid work arrangement
- Hiring process or interview steps
- Certifications
- Specific technologies or tools
- Years of experience required
- Employment type (full-time/part-time/contract)

Concretely:
- If no salary was supplied, do not mention salary, pay, or compensation at all.
- If nothing about visa sponsorship was supplied, do not mention visas or sponsorship at all.
- If no benefits were supplied, do not invent or imply any benefit.
- If no work arrangement was supplied, do not state or imply remote, on-site, or hybrid.
- If some information for a section is missing, write a brief, professional, genuinely useful section without fabricating specifics — do not pad it with invented facts to sound complete.

Output format — plain text only, with exactly these section headings in this order: Overview, Key Responsibilities, Required Qualifications, Preferred Skills.

Writing quality:
- Write like an experienced HR recruiter: concise, natural, professional English.
- Avoid repetitive sentences and vague generic phrases ("dynamic team", "fast-paced environment", "wear many hats", and similar filler).
- Avoid unnecessary verbosity — every sentence should carry real information.
- No emojis.
- No markdown tables, markdown headers, or HTML — plain text with simple line breaks and dashes for lists only.
- No fake or promotional marketing claims about the company beyond what was supplied.
- No Equal Opportunity Employer statement or other generic legal/compliance boilerplate paragraph.
- No discriminatory requirements (age, gender, marital status, religion, national origin, disability, or similar).
- No legal guarantees or exaggerated/unverifiable claims.
- No contact information, email addresses, or phone numbers.`;

function buildUserInput(input: GenerateJobDescriptionInput): string {
  const lines: string[] = [];
  if (input.companyName) lines.push(`Company: ${input.companyName}`);
  lines.push(`Job title: ${input.title}`);
  if (input.existingDescription) {
    lines.push("", "Existing description (authoritative context — build on this, never contradict it):", input.existingDescription, "");
  } else {
    lines.push("", "No existing description was provided.", "");
  }
  if (input.categoryName) lines.push(`Category: ${input.categoryName}`);
  if (input.countryName) lines.push(`Country: ${input.countryName}`);
  if (input.cityName) lines.push(`City: ${input.cityName}`);
  if (input.salaryMin && input.salaryMax && input.currencyCode) {
    lines.push(`Salary range: ${input.currencyCode} ${input.salaryMin}–${input.salaryMax}`);
  }
  if (input.applicationMethod) {
    lines.push(`Application method: ${input.applicationMethod === "external_url" ? "external link" : "on-platform application"}`);
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

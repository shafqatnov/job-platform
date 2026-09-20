import OpenAI, { APIConnectionTimeoutError } from "openai";
import { listCategories, listCountries } from "@/services/jobs/referenceData";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";

/**
 * The AI normalization/quality stage for already-validated, non-duplicate
 * imported jobs. Sits strictly between duplicate detection and the
 * future confidence-decision stage:
 *
 *   Duplicate Detection -> AI Normalization (this file) -> Confidence
 *   Decision (future) -> Auto Publish / Admin Review (future)
 *
 * This module makes NO publish/reject/admin_review decision — it only
 * returns a structured, normalized representation plus quality signals
 * for a future stage to act on. It never writes to the database, never
 * creates a Job row, and never changes an existing one.
 *
 * Reuses this repository's existing OpenAI integration conventions
 * (openAiModerationProvider.ts, generateJobDescription.ts): server-only
 * OpenAI Responses API call with strict JSON Schema Structured Outputs,
 * a server-controlled model (never client-supplied), the same
 * timeout/retry/error-sanitization pattern, and a second, independent
 * runtime validation pass over the parsed JSON before anything downstream
 * ever sees it — exactly like validateAiOutput.ts does for moderation,
 * kept as a separate, dedicated validator here since the output shape is
 * completely different from job moderation's.
 */

const DEFAULT_MODEL = "gpt-5.6-luna";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

// Matches this codebase's existing job title/description limits
// (createJob.ts/updateJob.ts) — an imported job is held to the same
// structural bounds a manually-posted one already is, not a separately
// invented limit. Enforced BEFORE calling OpenAI at all.
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;

const RESPONSE_FORMAT_NAME = "imported_job_normalization_result";

export type ImportedJobSalary = {
  min: number | null;
  max: number | null;
  currency: string | null;
};

export type ImportedJobQuality = {
  contentQuality: "good" | "weak" | "poor";
  concerns: string[];
  missingImportantFields: string[];
  suspiciousSignals: string[];
};

export type ImportedJobAiResult = {
  /** Preserved verbatim from the input — never asked of, or trusted from, the model. */
  sourceId: string;
  externalJobId: string;
  sourceUrl: string | null;

  normalizedTitle: string;
  normalizedDescription: string;
  country: string | null;
  city: string | null;
  category: string | null;
  skills: string[];
  experienceSummary: string | null;
  salary: ImportedJobSalary | null;
  employmentType: string | null;
  workArrangement: string | null;
  visaSponsorship: string | null;
  quality: ImportedJobQuality;
};

export type NormalizeImportedJobResult = { ok: true; result: ImportedJobAiResult } | { ok: false; error: string };

const GENERIC_ERROR = "We couldn't analyze this imported job right now. Please try again later.";
const VALID_CONTENT_QUALITY = new Set(["good", "weak", "poor"]);

function buildSystemInstructions(validCategoryNames: string[], validCountryNames: string[]): string {
  return `You are a data-normalization assistant for a job listings platform. You will be given ONE job posting imported from an external, authorized job source (e.g. an ATS job board). Your ONLY job is to clean up and structure the information that is already present — never to add information that isn't there.

The employer/source data is authoritative. You may:
- clean up wording and formatting
- normalize obvious location/category names to the platform's existing vocabulary
- extract skills explicitly mentioned in the text
- improve readability and structure of the description

You must NEVER:
- invent a salary, compensation figure, or benefit not explicitly stated
- invent visa sponsorship, remote/on-site/hybrid status, or an employment type not explicitly stated
- invent employer facts, years of experience, certifications, technologies, or company size not explicitly stated
- invent responsibilities or requirements not supported by the source text
- invent a city that isn't mentioned in the source location text
- turn a country-only location into a specific city
- change the factual meaning of the posting

Category: choose the single best match from this exact list of existing platform categories, or null if none genuinely fits (do not guess confidently): ${validCategoryNames.join(", ")}

Country: choose the single best match from this exact list of existing platform countries, or null if the location doesn't clearly indicate one of them: ${validCountryNames.join(", ")}

City: extract the city name only if one is literally present in the source location text; otherwise null. Never invent one.

Salary/employmentType/workArrangement/visaSponsorship/experienceSummary: only populate these if the source text explicitly states them; otherwise return null. Do not estimate or infer typical/market values.

Quality assessment: rate the posting's overall content quality as "good", "weak", or "poor" based on how complete, clear, and specific it is. List any concerns, important missing fields (e.g. no responsibilities, no requirements), or suspicious signals (e.g. spam-like, templated filler, contradictory details) you notice. This is NOT a publish/reject decision — you are only describing what you observe. Never return words like "publish", "reject", or "admin_review".`;
}

function buildUserInput(job: ValidatableRawJob): string {
  const lines = [
    `Title: ${job.title}`,
    `Location (as provided by the source, may be a country, city, region, or "Remote"): ${job.location ?? "(not provided)"}`,
  ];
  if (job.companyIdentity) {
    lines.push(`Company (as provided by the source): ${job.companyIdentity}`);
  }
  if (job.departments.length > 0) {
    lines.push(`Department(s): ${job.departments.join(", ")}`);
  }
  if (job.offices.length > 0) {
    lines.push(`Office(s): ${job.offices.join(", ")}`);
  }
  lines.push("", "Description:", job.description ?? "(not provided)");
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

function buildJsonSchema(validCategoryNames: string[], validCountryNames: string[]) {
  return {
    type: "object",
    properties: {
      normalizedTitle: { type: "string" },
      normalizedDescription: { type: "string" },
      country: { type: ["string", "null"], enum: [...validCountryNames, null] },
      city: { type: ["string", "null"] },
      category: { type: ["string", "null"], enum: [...validCategoryNames, null] },
      skills: { type: "array", items: { type: "string" } },
      experienceSummary: { type: ["string", "null"] },
      salary: {
        type: ["object", "null"],
        properties: {
          min: { type: ["number", "null"] },
          max: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
        },
        required: ["min", "max", "currency"],
        additionalProperties: false,
      },
      employmentType: { type: ["string", "null"] },
      workArrangement: { type: ["string", "null"] },
      visaSponsorship: { type: ["string", "null"] },
      quality: {
        type: "object",
        properties: {
          contentQuality: { type: "string", enum: ["good", "weak", "poor"] },
          concerns: { type: "array", items: { type: "string" } },
          missingImportantFields: { type: "array", items: { type: "string" } },
          suspiciousSignals: { type: "array", items: { type: "string" } },
        },
        required: ["contentQuality", "concerns", "missingImportantFields", "suspiciousSignals"],
        additionalProperties: false,
      },
    },
    required: [
      "normalizedTitle",
      "normalizedDescription",
      "country",
      "city",
      "category",
      "skills",
      "experienceSummary",
      "salary",
      "employmentType",
      "workArrangement",
      "visaSponsorship",
      "quality",
    ],
    additionalProperties: false,
  } as const;
}

type ModelOutput = Omit<ImportedJobAiResult, "sourceId" | "externalJobId" | "sourceUrl">;

/**
 * The only place raw model output is trusted. Independent of the JSON
 * Schema constraint the model was given — a defense-in-depth check, not
 * a redundant formality, matching validateAiOutput.ts's own reasoning.
 * Rejects (returns null) on anything structurally unexpected rather than
 * guessing or coercing.
 */
function validateModelOutput(
  raw: unknown,
  validCategoryNames: Set<string>,
  validCountryNames: Set<string>
): ModelOutput | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.normalizedTitle !== "string" || typeof candidate.normalizedDescription !== "string") {
    return null;
  }

  const country = candidate.country;
  if (country !== null && (typeof country !== "string" || !validCountryNames.has(country))) {
    return null;
  }

  const city = candidate.city;
  if (city !== null && typeof city !== "string") {
    return null;
  }

  const category = candidate.category;
  if (category !== null && (typeof category !== "string" || !validCategoryNames.has(category))) {
    return null;
  }

  const skills = candidate.skills;
  if (!Array.isArray(skills) || !skills.every((skill) => typeof skill === "string")) {
    return null;
  }

  const experienceSummary = candidate.experienceSummary;
  if (experienceSummary !== null && typeof experienceSummary !== "string") {
    return null;
  }

  let salary: ImportedJobSalary | null = null;
  const salaryRaw = candidate.salary;
  if (salaryRaw !== null) {
    if (typeof salaryRaw !== "object") {
      return null;
    }
    const salaryCandidate = salaryRaw as Record<string, unknown>;
    const min = salaryCandidate.min;
    const max = salaryCandidate.max;
    const currency = salaryCandidate.currency;
    if (
      (min !== null && typeof min !== "number") ||
      (max !== null && typeof max !== "number") ||
      (currency !== null && typeof currency !== "string")
    ) {
      return null;
    }
    salary = { min: min as number | null, max: max as number | null, currency: currency as string | null };
  }

  const employmentType = candidate.employmentType;
  if (employmentType !== null && typeof employmentType !== "string") {
    return null;
  }
  const workArrangement = candidate.workArrangement;
  if (workArrangement !== null && typeof workArrangement !== "string") {
    return null;
  }
  const visaSponsorship = candidate.visaSponsorship;
  if (visaSponsorship !== null && typeof visaSponsorship !== "string") {
    return null;
  }

  const qualityRaw = candidate.quality;
  if (typeof qualityRaw !== "object" || qualityRaw === null) {
    return null;
  }
  const qualityCandidate = qualityRaw as Record<string, unknown>;
  const contentQuality = qualityCandidate.contentQuality;
  if (typeof contentQuality !== "string" || !VALID_CONTENT_QUALITY.has(contentQuality)) {
    return null;
  }
  const concerns = qualityCandidate.concerns;
  const missingImportantFields = qualityCandidate.missingImportantFields;
  const suspiciousSignals = qualityCandidate.suspiciousSignals;
  if (
    !Array.isArray(concerns) ||
    !concerns.every((v) => typeof v === "string") ||
    !Array.isArray(missingImportantFields) ||
    !missingImportantFields.every((v) => typeof v === "string") ||
    !Array.isArray(suspiciousSignals) ||
    !suspiciousSignals.every((v) => typeof v === "string")
  ) {
    return null;
  }

  return {
    normalizedTitle: candidate.normalizedTitle,
    normalizedDescription: candidate.normalizedDescription,
    country: country as string | null,
    city: city as string | null,
    category: category as string | null,
    skills: skills as string[],
    experienceSummary: experienceSummary as string | null,
    salary,
    employmentType: employmentType as string | null,
    workArrangement: workArrangement as string | null,
    visaSponsorship: visaSponsorship as string | null,
    quality: {
      contentQuality: contentQuality as ImportedJobQuality["contentQuality"],
      concerns: concerns as string[],
      missingImportantFields: missingImportantFields as string[],
      suspiciousSignals: suspiciousSignals as string[],
    },
  };
}

/**
 * Runs one already-validated, non-duplicate imported job through AI
 * normalization. Never persists anything, never makes a publish
 * decision. sourceId/externalJobId/sourceUrl in the result are copied
 * directly from `job` — the model is never asked for them and could not
 * influence them even if it tried.
 */
export async function normalizeImportedJob(job: ValidatableRawJob): Promise<NormalizeImportedJobResult> {
  const title = job.title.trim();
  if (!title) {
    return { ok: false, error: "Job title is required before it can be analyzed." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "Job title is too long to analyze." };
  }
  if (job.description && job.description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: "Job description is too long to analyze." };
  }

  const client = createClient();
  if (!client) {
    console.error("normalizeImportedJob: OPENAI_API_KEY is not configured for this environment.");
    return { ok: false, error: GENERIC_ERROR };
  }

  const [categories, countries] = await Promise.all([listCategories(), listCountries()]);
  const validCategoryNames = categories.map((category) => category.name);
  const validCountryNames = countries.map((country) => country.name);

  // OPENAI_IMPORT_NORMALIZATION_MODEL is optional; this feature works
  // with only OPENAI_API_KEY configured, matching the other two AI
  // integrations' own environment constraints.
  const model = process.env.OPENAI_IMPORT_NORMALIZATION_MODEL || DEFAULT_MODEL;

  let response;
  try {
    response = await client.responses.create({
      model,
      instructions: buildSystemInstructions(validCategoryNames, validCountryNames),
      input: buildUserInput(job),
      text: {
        format: {
          type: "json_schema",
          name: RESPONSE_FORMAT_NAME,
          strict: true,
          schema: buildJsonSchema(validCategoryNames, validCountryNames),
        },
      },
    });
  } catch (error) {
    if (error instanceof APIConnectionTimeoutError) {
      console.error(`normalizeImportedJob timed out after ${REQUEST_TIMEOUT_MS}ms for source ${job.sourceId}`);
      return { ok: false, error: GENERIC_ERROR };
    }
    const message = error instanceof Error ? error.message : "Unknown error calling the AI provider.";
    console.error("normalizeImportedJob failed:", sanitizeErrorDetail(message));
    return { ok: false, error: GENERIC_ERROR };
  }

  if (response.status !== "completed" || !response.output_text) {
    console.error(`normalizeImportedJob: response did not complete (status: ${response.status ?? "unknown"})`);
    return { ok: false, error: GENERIC_ERROR };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    console.error("normalizeImportedJob: response text was not valid JSON");
    return { ok: false, error: GENERIC_ERROR };
  }

  const validated = validateModelOutput(parsed, new Set(validCategoryNames), new Set(validCountryNames));
  if (!validated) {
    console.error("normalizeImportedJob: model output failed structural validation");
    return { ok: false, error: GENERIC_ERROR };
  }

  return {
    ok: true,
    result: {
      sourceId: job.sourceId,
      externalJobId: job.externalJobId,
      sourceUrl: job.sourceUrl,
      ...validated,
    },
  };
}

/**
 * Deterministic validation stage for imported raw jobs (currently
 * GreenhouseRawJob-shaped, structurally). Sits strictly between the
 * importer and the future duplicate-detection stage:
 *
 *   Importer -> Validation (this file) -> Duplicate Detection (future) ->
 *   AI Normalization (future) -> Confidence Decision (future) ->
 *   Auto Publish / Admin Review (future)
 *
 * `valid: true` means ONLY "this record is structurally usable" — it is
 * NOT a legal-authorization, trust, spam, or quality signal, and never
 * implies a job is safe to auto-publish. No AI call, no semantic
 * duplicate detection, no category classification, no description
 * rewriting, and no invented/defaulted values happen here. Rules are
 * deterministic and reuse existing conventions (isSafeExternalUrl,
 * MAX_TITLE_LENGTH) rather than inventing new ones.
 */

import { isSafeExternalUrl } from "@/services/jobs/createJob";

// Mirrors createJob.ts's/updateJob.ts's own MAX_TITLE_LENGTH exactly (not
// exported by createJob.ts, so duplicated here — the same pattern those
// two files already use between each other). An imported job's title is
// held to the same structural limit a manually-posted job already is.
const MAX_TITLE_LENGTH = 200;

// The exact test-fixture marker this codebase's own automated tests use
// (src/test-utils/moderationFixtures.ts's TEST_LABEL_PREFIX) — reused
// here by value, not re-imported (a production validation module should
// not depend on a test-utils module), purely to reject our own test data
// if it were ever accidentally fed through a real pipeline run. This is
// an exact-prefix check only — never a general keyword/spam filter, and
// it does nothing to a title that merely happens to contain the word
// "test".
const KNOWN_TEST_FIXTURE_MARKER = "[AI MODERATION TEST]";

const VALID_RAW_SOURCE_TYPES = new Set(["ATS"]);

export type ImportedJobRejectionReason =
  | "missing_source_id"
  | "missing_external_job_id"
  | "missing_title"
  | "title_too_long"
  | "invalid_source_url"
  | "missing_description"
  | "invalid_raw_source_type"
  | "known_test_fixture_marker";

/**
 * The minimal shape this validator needs. Structurally compatible with
 * GreenhouseRawJob (any GreenhouseRawJob satisfies this without casting)
 * but with a wider `rawSourceType: string` so a future connector's
 * out-of-range value can actually be represented and rejected here,
 * rather than being ruled out entirely by TypeScript before validation
 * ever runs.
 */
export type ValidatableRawJob = {
  sourceId: string;
  externalJobId: string;
  title: string;
  location: string | null;
  description: string | null;
  sourceUrl: string | null;
  updatedAt: string;
  rawSourceType: string;
  companyIdentity: string | null;
  departments: string[];
  offices: string[];
};

export type ImportedJobValidationResult<T extends ValidatableRawJob = ValidatableRawJob> = {
  valid: boolean;
  reasons: ImportedJobRejectionReason[];
  /** The exact same object reference passed in — never mutated, never copied-and-changed. */
  job: T;
};

function stripHtmlToText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Validates one raw imported job. Read-only: never mutates `job`, never
 * touches a database, never calls an external service.
 *
 * Deliberately does NOT validate `location` — Greenhouse (and other
 * ATS/board sources) frequently omit it, and the chosen rule is to leave
 * it exactly as received (including null) rather than reject on absence
 * or invent a value.
 */
export function validateImportedJob<T extends ValidatableRawJob>(job: T): ImportedJobValidationResult<T> {
  const reasons: ImportedJobRejectionReason[] = [];

  if (!job.sourceId.trim()) {
    reasons.push("missing_source_id");
  }

  if (!job.externalJobId.trim()) {
    reasons.push("missing_external_job_id");
  }

  const title = job.title.trim();
  if (!title) {
    reasons.push("missing_title");
  } else if (title.length > MAX_TITLE_LENGTH) {
    reasons.push("title_too_long");
  }

  if (!job.sourceUrl || !isSafeExternalUrl(job.sourceUrl)) {
    reasons.push("invalid_source_url");
  }

  if (!job.description || stripHtmlToText(job.description).length === 0) {
    reasons.push("missing_description");
  }

  if (!VALID_RAW_SOURCE_TYPES.has(job.rawSourceType)) {
    reasons.push("invalid_raw_source_type");
  }

  if (title.startsWith(KNOWN_TEST_FIXTURE_MARKER) || (job.companyIdentity ?? "").startsWith(KNOWN_TEST_FIXTURE_MARKER)) {
    reasons.push("known_test_fixture_marker");
  }

  return { valid: reasons.length === 0, reasons, job };
}

export type BatchImportedJobValidationResult<T extends ValidatableRawJob = ValidatableRawJob> = {
  valid: ImportedJobValidationResult<T>[];
  rejected: ImportedJobValidationResult<T>[];
};

/**
 * Validates a batch independently — one malformed/invalid job never
 * stops or invalidates the rest of the batch. Each result still carries
 * its own `job` (with sourceId/externalJobId intact) for traceability.
 */
export function validateImportedJobs<T extends ValidatableRawJob>(rawJobs: T[]): BatchImportedJobValidationResult<T> {
  const valid: ImportedJobValidationResult<T>[] = [];
  const rejected: ImportedJobValidationResult<T>[] = [];

  for (const rawJob of rawJobs) {
    const result = validateImportedJob(rawJob);
    (result.valid ? valid : rejected).push(result);
  }

  return { valid, rejected };
}

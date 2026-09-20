/**
 * The confidence-decision stage for the imported-job pipeline. Sits
 * strictly between AI normalization and the still-unbuilt publishing
 * stage:
 *
 *   AI Normalization -> Confidence Decision (this file) -> Auto Publish
 *   / Admin Review (future)
 *
 * Pure and fully deterministic: no OpenAI call, no database read or
 * write, no I/O of any kind. It only combines results already produced
 * by the earlier stages (validation, duplicate detection, AI
 * normalization) plus the source eligibility state the caller already
 * determined, and returns a routing RECOMMENDATION. It never publishes,
 * creates, or modifies a Job row — "auto_publish" means only "this job
 * has passed every currently implemented technical/deterministic gate
 * and may proceed to a future publishing stage," nothing more.
 *
 * This stage also makes no legal/compliance claim: `sourceEligible`
 * reflects only the technical registry/configuration state the caller
 * supplies (enabled, correctly configured, matching connector type) —
 * never an assertion that the source is legally authorized to use.
 */

import type { ImportedJobValidationResult, ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { DuplicateDetectionResult } from "@/services/deduplication/detectImportedJobDuplicates";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";

export type ImportedJobDecisionOutcome = "auto_publish" | "admin_review" | "do_not_publish";

export type ImportedJobDecision = {
  decision: ImportedJobDecisionOutcome;
  /** Machine-readable, fixed-vocabulary codes — never raw free-text AI output. */
  reasons: string[];
};

export type ImportedJobDecisionInput<T extends ValidatableRawJob = ValidatableRawJob> = {
  validation: ImportedJobValidationResult<T>;
  duplicate: DuplicateDetectionResult<T>;
  normalization: NormalizeImportedJobResult;
  /**
   * Whether this job's AuthorizedJobSource was enabled, correctly
   * configured, and eligible at the time it was imported — as already
   * determined by the registry/importer/connector stages. This module
   * never re-derives or queries that state itself; it only trusts what
   * the caller supplies, per this task's "may rely only on the
   * source-registry eligibility state already supplied by the caller"
   * rule.
   */
  sourceEligible: boolean;
};

/**
 * Decision precedence (highest priority first — a later rule can never
 * override an earlier one's outcome):
 *
 *  1. Source ineligible (disabled/misconfigured)        -> do_not_publish
 *  2. Deterministic validation failed                   -> do_not_publish
 *     (this already covers: missing source/external id, invalid source
 *     URL, missing/oversized title, missing description, invalid
 *     rawSourceType, AND the known test-fixture marker — all of these
 *     are validateImportedJob.ts's own existing rejection reasons,
 *     reused here verbatim rather than re-implemented)
 *  3. Exact duplicate                                   -> do_not_publish
 *  4. AI normalization failed / malformed                -> admin_review
 *  5. Possible duplicate                                 -> admin_review
 *  6. AI quality concerns (weak/poor content, suspicious
 *     signals, missing important fields, uncertain
 *     category/location)                                 -> admin_review
 *  7. None of the above                                  -> auto_publish
 *
 * Tiers 1–3 are hard blocks: if ANY apply, the result is always
 * do_not_publish with every matching reason listed, regardless of how
 * good the AI's quality assessment was — a positive quality signal can
 * never override a hard failure. Tiers 4–6 behave the same way one level
 * down: if none of 1–3 apply but any of 4–6 do, the result is always
 * admin_review with every matching reason listed. Only when nothing in
 * tiers 1–6 applies does this function return auto_publish.
 */
export function decideImportedJobConfidence<T extends ValidatableRawJob>(
  input: ImportedJobDecisionInput<T>
): ImportedJobDecision {
  const hardBlockReasons: string[] = [];

  if (!input.sourceEligible) {
    hardBlockReasons.push("source_ineligible");
  }

  if (!input.validation.valid) {
    hardBlockReasons.push(...input.validation.reasons);
  }

  if (input.duplicate.outcome === "exact_duplicate") {
    hardBlockReasons.push("exact_duplicate");
  }

  if (hardBlockReasons.length > 0) {
    return { decision: "do_not_publish", reasons: hardBlockReasons };
  }

  const reviewReasons: string[] = [];

  if (!input.normalization.ok) {
    reviewReasons.push("ai_normalization_failed");
  }

  if (input.duplicate.outcome === "possible_duplicate") {
    reviewReasons.push("possible_duplicate");
  }

  if (input.normalization.ok) {
    const { quality, category, country } = input.normalization.result;

    if (quality.contentQuality === "poor") {
      reviewReasons.push("content_quality_poor");
    } else if (quality.contentQuality === "weak") {
      reviewReasons.push("content_quality_weak");
    }

    if (quality.suspiciousSignals.length > 0) {
      reviewReasons.push("suspicious_signals_present");
    }

    if (quality.missingImportantFields.length > 0) {
      reviewReasons.push("missing_important_fields");
    }

    if (category === null) {
      reviewReasons.push("category_uncertain");
    }

    // A null city alone is common and legitimate (e.g. "Remote" or a
    // country-only posting) and is never treated as uncertainty on its
    // own — only a null country (which almost every real job should
    // have) is treated as a location-confidence signal.
    if (country === null) {
      reviewReasons.push("location_uncertain");
    }
  }

  if (reviewReasons.length > 0) {
    return { decision: "admin_review", reasons: reviewReasons };
  }

  return { decision: "auto_publish", reasons: [] };
}

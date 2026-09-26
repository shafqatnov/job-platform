import { listJobSources } from "@/services/admin/jobSources";
import { runAdzunaOilAndGasImporter } from "@/services/importers/adzunaImporter";
import type { AdzunaRawJob } from "@/services/connectors/adzunaConnector";
import { validateImportedJob } from "@/services/validation/validateImportedJob";
import { detectImportedJobDuplicates } from "@/services/deduplication/detectImportedJobDuplicates";
import { normalizeImportedJob, type NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import { findCountryByIsoCode } from "@/services/jobs/referenceData";
import { decideImportedJobConfidence } from "@/services/decision/decideImportedJobConfidence";
import { ingestImportedJob } from "@/services/publishing/publishImportedJob";

/**
 * The Adzuna sync entry point — the future scheduler-triggered unit of
 * work (see src/app/api/cron/sync-adzuna/route.ts), mirroring
 * processPendingJobs.ts's own "batch entry point a future
 * scheduler/worker can call safely" shape exactly. Runs the FULL
 * existing imported-job pipeline unchanged:
 *
 *   Adzuna Connector -> Importer -> Validation -> Duplicate Detection ->
 *   AI Normalization -> Confidence Decision -> Publishing/Admin Review
 *
 * As of "Jobnura — Adzuna Oil & Gas Expansion v1.0," fetches via
 * runAdzunaOilAndGasImporter() — a controlled, budget-capped rotation
 * across 8 Adzuna-supported countries and a small Oil & Gas keyword
 * profile set (see adzunaImporter.ts's own doc comment for the full
 * design) — rather than the original 2-country/page-1 controlled test
 * scope. Everything from validation onward below is unchanged.
 *
 * HARD GATE (re-checked here, independent of the importer's own
 * `enabled` check, exactly like every other layer in this pipeline
 * re-verifies its own preconditions rather than trusting a caller):
 * this function calls the real Adzuna API ONLY when the registry's
 * "Adzuna" row exists, has authorizationStatus === "verified", AND is
 * enabled === true. Any other state stops safely before any network
 * call and before any publish — no job is ever processed, no OpenAI
 * call is ever made, in that case.
 *
 * Never invoked automatically by anything in this codebase — the HTTP
 * trigger route itself requires ADZUNA_SYNC_TRIGGER_SECRET to be
 * configured (see checkSecureTrigger's own fail-closed behavior), which
 * is not set anywhere by this change, so the whole path stays inert
 * until a human deliberately configures both that secret AND the
 * registry's authorization/enablement state.
 */

export type SyncAdzunaJobsGateResult = { ok: false; reason: "source_not_found" | "unauthorized" | "disabled" };

export type SyncAdzunaJobsSummary = {
  ok: true;
  fetchedCount: number;
  validCount: number;
  invalidCount: number;
  exactDuplicateCount: number;
  possibleDuplicateCount: number;
  publishedCount: number;
  queuedForReviewCount: number;
  rejectedCount: number;
  failedCount: number;
};

export type SyncAdzunaJobsResult = SyncAdzunaJobsGateResult | SyncAdzunaJobsSummary;

/**
 * ADZUNA-SPECIFIC OPTIMIZATION 1 — deterministic country resolution.
 *
 * The importer already knows, with certainty, which Adzuna country
 * code (gb/us) each listing was fetched under (AdzunaRawJob's own
 * adzunaCountryCode field) — this is ground truth from the API call
 * itself, not a guess. Previously the pipeline still asked the AI to
 * INFER the country purely from free-text location strings like
 * "Halstad, Norman County", which the AI correctly (and safely) refused
 * to guess for genuinely ambiguous US county-only text, returning null
 * and routing the job to Unknown Location Review as "location_uncertain"
 * — a false positive, since the country was never actually in doubt.
 *
 * This maps the known Adzuna country code directly to Jobnura's real,
 * existing Country row and prefers it over the AI's own guess whenever
 * it resolves — the AI's country field is left untouched (and the
 * Unknown Location Review path still fully applies) if the code can't
 * be resolved to a real Country row, which preserves the existing
 * safety net for the (currently impossible, but not assumed-impossible)
 * case of an unrecognized code. City resolution is completely
 * unaffected — still AI/ResolvedLocationAlias-driven exactly as before.
 *
 * This never touches decideImportedJobConfidence.ts, normalizeImportedJob.ts,
 * or publishImportedJob.ts — only the AI result this Adzuna-only file
 * itself passes into them — so no other source's behavior changes.
 */
async function preferDeterministicAdzunaCountry(
  rawJob: AdzunaRawJob,
  normalization: NormalizeImportedJobResult
): Promise<NormalizeImportedJobResult> {
  if (!normalization.ok) {
    return normalization;
  }

  const knownCountry = await findCountryByIsoCode(rawJob.adzunaCountryCode);
  if (!knownCountry) {
    // Genuinely unresolvable — fall through to the existing Unknown
    // Location Review workflow exactly as before. Never guessed.
    return normalization;
  }

  return {
    ...normalization,
    result: { ...normalization.result, country: knownCountry.name },
  };
}

/**
 * ADZUNA-SPECIFIC OPTIMIZATION 2 — snippet-aware quality signal.
 *
 * Adzuna's Search API always returns a short description SNIPPET, never
 * a complete posting (see AdzunaRawJob.description's own doc comment).
 * The AI's quality assessment is content-based and has no way to know
 * this — so it frequently (and, taken alone, correctly) reports "weak"
 * content quality and lists missing sections/fields, purely because the
 * text it was given is short. That is a structural characteristic of
 * this data source, not a genuine quality problem with any individual
 * listing, so treating it as an admin_review trigger is a false
 * positive for Adzuna specifically.
 *
 * This narrowly discounts ONLY that combination — contentQuality
 * exactly "weak" AND zero suspicious signals — down to "good" with no
 * missing-fields flag. It NEVER touches:
 *  - a "poor" quality verdict (a stronger, more deliberate signal,
 *    always still routes to review),
 *  - any suspicious signal (always still routes to review),
 *  - category/location uncertainty, validation failures, or duplicate
 *    detection (all untouched, still fully authoritative).
 * decideImportedJobConfidence.ts itself is never modified — every other
 * source's confidence thresholds are completely unaffected.
 */
function discountAdzunaSnippetQualitySignal(normalization: NormalizeImportedJobResult): NormalizeImportedJobResult {
  if (!normalization.ok) {
    return normalization;
  }
  const { quality } = normalization.result;
  if (quality.contentQuality !== "weak" || quality.suspiciousSignals.length > 0) {
    return normalization;
  }

  return {
    ...normalization,
    result: {
      ...normalization.result,
      quality: { ...quality, contentQuality: "good", missingImportantFields: [] },
    },
  };
}

/**
 * ADZUNA-SPECIFIC OPTIMIZATION 3 — strip source-truncation meta-commentary.
 *
 * Because Adzuna's description is always a short, mid-sentence-cut
 * snippet (see AdzunaRawJob.description's own doc comment), the AI
 * normalization step frequently appends a trailing note ABOUT that
 * truncation itself — e.g. "The source description is truncated after
 * 'roadside resc…'" or "[Source description is truncated.]" — as part
 * of its own normalizedDescription output. That note is true and
 * harmless as an internal observation, but it is never real job content
 * and reads as a broken/unprofessional artifact on a live, public job
 * page (confirmed present on this exact task's one currently-published
 * Adzuna job).
 *
 * This narrowly removes only that trailing sentence/bracketed clause —
 * matched by the specific, unambiguous combination of "source"/
 * "supplied description" together with "truncat…"/"ends mid-sentence"
 * in the same sentence, a combination essentially impossible in genuine
 * employer-authored content — and leaves every other sentence
 * (including any other AI commentary this task deliberately does not
 * attempt to also clean up) untouched. Falls back to the original
 * description if stripping would ever leave nothing behind, so a
 * description is never emptied by this. Never touches
 * normalizeImportedJob.ts's shared prompt/logic, so Greenhouse and every
 * other source's normalization behavior is completely unaffected.
 */
// Observed AI phrasings for this note vary ("is truncated", "ends
// abruptly", "ends mid-sentence", "appears truncated in the source",
// "truncated in the source posting"), so this filters whole sentences
// that combine BOTH a reference to the source material itself AND a
// truncation/incompleteness word — a combination essentially impossible
// in genuine employer-authored job content.
const SOURCE_REFERENCE_PATTERN =
  /\b(?:the\s+)?(?:source|supplied)\s+(?:description|posting|text|snippet|listing)\b|\bdescription\b[^.!?]{0,30}\bsource\b/i;
const TRUNCATION_WORD_PATTERN = /truncat\w*|ends?\s+abruptly|ends?\s+mid-sentence|\bincomplete\b|cuts?\s+off/i;

function stripAdzunaSourceTruncationNotes(normalization: NormalizeImportedJobResult): NormalizeImportedJobResult {
  if (!normalization.ok) {
    return normalization;
  }

  // Bracketed notes (e.g. "[Description appears truncated in the
  // source.]") are handled as their own whole unit FIRST — the sentence
  // splitter below would otherwise break on the period inside the
  // brackets and leave a stray "]" behind.
  const withoutBracketedNotes = normalization.result.normalizedDescription.replace(/\[[^\]]*\]/g, (bracketed) =>
    SOURCE_REFERENCE_PATTERN.test(bracketed) && TRUNCATION_WORD_PATTERN.test(bracketed) ? "" : bracketed
  );

  const sentences = withoutBracketedNotes.match(/[^.!?]+[.!?]?/g) ?? [withoutBracketedNotes];
  const cleaned = sentences
    .filter((sentence) => !(SOURCE_REFERENCE_PATTERN.test(sentence) && TRUNCATION_WORD_PATTERN.test(sentence)))
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!cleaned) {
    return normalization;
  }

  return {
    ...normalization,
    result: { ...normalization.result, normalizedDescription: cleaned },
  };
}

export async function syncAdzunaJobs(): Promise<SyncAdzunaJobsResult> {
  const runStartedAt = Date.now();
  const sources = await listJobSources();
  const adzunaSource = sources.find((source) => source.name === "Adzuna");

  if (!adzunaSource) {
    return { ok: false, reason: "source_not_found" };
  }
  if (adzunaSource.authorizationStatus !== "verified") {
    return { ok: false, reason: "unauthorized" };
  }
  if (!adzunaSource.enabled) {
    return { ok: false, reason: "disabled" };
  }

  const importResult = await runAdzunaOilAndGasImporter();
  // runAdzunaOilAndGasImporter independently re-derives eligibility from
  // the same registry (enabled + Adzuna hostname) — if that disagrees
  // with the check above (a genuine race between two overlapping calls),
  // stop safely rather than processing a partial/stale result.
  if (!importResult.totalSourcesEligible) {
    return { ok: false, reason: "disabled" };
  }

  // Per-combination observability: country, keyword profile, page, and
  // outcome only — never a raw error message body (already reduced to a
  // safe, generic string by the connector itself) and never a credential.
  for (const outcome of importResult.results) {
    console.log(
      JSON.stringify({
        event: "adzuna_sync_combination_result",
        countryCode: outcome.countryCode,
        keyword: outcome.keyword,
        page: outcome.page,
        success: outcome.success,
        resultCount: outcome.resultCount,
      })
    );
  }

  const rawJobs = importResult.jobs;
  const validationResults = rawJobs.map((job) => ({ job, result: validateImportedJob(job) }));
  const validEntries = validationResults.filter((entry) => entry.result.valid);
  const validJobs = validEntries.map((entry) => entry.job);

  const duplicateResults = await detectImportedJobDuplicates(validJobs);

  let publishedCount = 0;
  let queuedForReviewCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;
  let exactDuplicateCount = 0;
  let possibleDuplicateCount = 0;

  // Sequential, one job at a time — never Promise.all — so this never
  // bursts requests against either Adzuna (already fetched in bulk
  // above, nothing further called per-job) or OpenAI, honoring this
  // task's "process incrementally, respect API rate limits."
  for (let i = 0; i < validJobs.length; i++) {
    const rawJob = validJobs[i];
    const validation = validEntries[i].result;
    const duplicate = duplicateResults[i];

    if (duplicate.outcome === "exact_duplicate") {
      exactDuplicateCount += 1;
    } else if (duplicate.outcome === "possible_duplicate") {
      possibleDuplicateCount += 1;
    }

    // An exact duplicate can never publish regardless of AI output
    // (decideImportedJobConfidence's own hard-block precedence) — skip
    // the AI call entirely rather than spend an OpenAI request on a
    // job that is already guaranteed do_not_publish.
    let normalization: NormalizeImportedJobResult =
      duplicate.outcome === "exact_duplicate"
        ? { ok: false, error: "Skipped AI normalization: exact duplicate of an already-processed listing." }
        : await normalizeImportedJob(rawJob);

    if (duplicate.outcome !== "exact_duplicate") {
      normalization = await preferDeterministicAdzunaCountry(rawJob, normalization);
      normalization = discountAdzunaSnippetQualitySignal(normalization);
      normalization = stripAdzunaSourceTruncationNotes(normalization);
    }

    const decision = decideImportedJobConfidence({
      validation,
      duplicate,
      normalization,
      sourceEligible: true,
    });

    const result = await ingestImportedJob({
      rawJob,
      normalization,
      decision,
      provenance: { countryCode: rawJob.adzunaCountryCode, keyword: rawJob.adzunaKeyword },
    });
    logSyncResult(rawJob.sourceId, rawJob.externalJobId, result.outcome);

    if (result.outcome === "published") publishedCount += 1;
    else if (result.outcome === "queued_for_review") queuedForReviewCount += 1;
    else if (result.outcome === "rejected") rejectedCount += 1;
    else failedCount += 1;
  }

  // Run-level summary — safe to log in full: no credentials, no job
  // title/description content, only identifiers and counts. Note
  // queuedForReviewCount above covers BOTH genuine admin_review items
  // AND auto_publish items still blocked on an unresolved location
  // (ingestImportedJob's own "queued_for_review" outcome doesn't
  // distinguish the two) — splitting that further would require
  // changing publishImportedJob.ts's own result contract, which this
  // task deliberately does not touch.
  console.log(
    JSON.stringify({
      event: "adzuna_sync_run_summary",
      requestsUsed: importResult.requestsUsed,
      requestBudget: importResult.requestBudget,
      requestBudgetReached: importResult.requestBudgetReached,
      candidatesCollected: importResult.candidatesCollected,
      candidateBudget: importResult.candidateBudget,
      candidateBudgetReached: importResult.candidateBudgetReached,
      combinationsDeferredToFutureRuns: importResult.combinationsDeferredToFutureRuns,
      fetchedCount: rawJobs.length,
      validCount: validJobs.length,
      invalidCount: rawJobs.length - validJobs.length,
      exactDuplicateCount,
      possibleDuplicateCount,
      publishedCount,
      queuedForReviewCount,
      rejectedCount,
      failedCount,
      runDurationMs: Date.now() - runStartedAt,
    })
  );

  return {
    ok: true,
    fetchedCount: rawJobs.length,
    validCount: validJobs.length,
    invalidCount: rawJobs.length - validJobs.length,
    exactDuplicateCount,
    possibleDuplicateCount,
    publishedCount,
    queuedForReviewCount,
    rejectedCount,
    failedCount,
  };
}

/**
 * Structured, safe logging only — external identity and outcome, never
 * title/description content, never a credential. Mirrors
 * processPendingJobs.ts's own logModerationResult exactly.
 */
function logSyncResult(sourceId: string, externalJobId: string, outcome: string): void {
  console.log(JSON.stringify({ event: "adzuna_sync_job_result", sourceId, externalJobId, outcome }));
}

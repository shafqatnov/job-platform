import { listJobSources } from "@/services/admin/jobSources";
import { runGreenhouseImporter } from "@/services/importers/greenhouseImporter";
import { validateImportedJob } from "@/services/validation/validateImportedJob";
import { detectImportedJobDuplicates } from "@/services/deduplication/detectImportedJobDuplicates";
import { normalizeImportedJob, type NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import { decideImportedJobConfidence } from "@/services/decision/decideImportedJobConfidence";
import { ingestImportedJob } from "@/services/publishing/publishImportedJob";

/**
 * The Greenhouse manual-sync entry point — mirrors syncAdzunaJobs.ts's
 * own shape exactly, adapted for Greenhouse's per-employer-board
 * topology (Adzuna is one fixed, single source; Greenhouse is many
 * independent AuthorizedJobSource rows, one per employer board). Runs
 * the FULL existing imported-job pipeline unchanged:
 *
 *   Greenhouse Connector -> Importer -> Validation -> Duplicate
 *   Detection -> AI Normalization -> Confidence Decision ->
 *   Publishing/Admin Review
 *
 * HARD GATE (re-checked here, independent of any caller's own belief
 * about a source's state, exactly like syncAdzunaJobs.ts's own gate):
 * this function ever calls the real Greenhouse API for the given
 * sourceId ONLY when that exact registry row exists, has
 * authorizationStatus === "verified", AND is enabled === true. Any
 * other state stops safely before any network call and before any
 * publish — no job is ever processed, no OpenAI call is ever made.
 *
 * PER-SOURCE SCOPING WITHOUT MODIFYING THE EXISTING IMPORTER: this
 * function takes a specific sourceId (the one employer board an admin
 * clicked "Sync Now" on) rather than syncing every enabled Greenhouse
 * source at once. runGreenhouseImporter() itself is reused completely
 * unmodified — it still fans out across every enabled Greenhouse
 * source in one call (its own existing, preserved topology) — but this
 * function only ever runs the downstream pipeline (validate ->
 * duplicate detection -> AI -> confidence -> publish) over the ONE
 * result entry matching the requested sourceId. Any OTHER employer
 * board's fetched jobs are read (an inherent, side-effect-free property
 * of the existing importer's own shape) but never validated, never
 * normalized, and never published as a side effect of this call — only
 * the specific board an admin asked to sync is ever affected. This adds
 * zero new fetch/orchestration logic: runGreenhouseImporter's own
 * per-source result shape (GreenhouseSourceImportResult, already
 * scoped to exactly one source's own jobs) is all that's needed.
 *
 * Never invoked automatically by anything in this codebase — only a
 * human admin action (syncGreenhouseNowAction.ts) calls this, and only
 * for a source that admin action itself also independently re-verifies
 * server-side before calling here.
 */

export type SyncGreenhouseJobsGateResult = {
  ok: false;
  reason: "source_not_found" | "unauthorized" | "disabled" | "not_a_greenhouse_source" | "fetch_failed";
  detail?: string;
};

export type SyncGreenhouseJobsSummary = {
  ok: true;
  sourceId: string;
  sourceName: string;
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

export type SyncGreenhouseJobsResult = SyncGreenhouseJobsGateResult | SyncGreenhouseJobsSummary;

export async function syncGreenhouseJobs(sourceId: string): Promise<SyncGreenhouseJobsResult> {
  const sources = await listJobSources();
  const source = sources.find((s) => s.id === sourceId);

  if (!source) {
    return { ok: false, reason: "source_not_found" };
  }
  if (source.authorizationStatus !== "verified") {
    return { ok: false, reason: "unauthorized" };
  }
  if (!source.enabled) {
    return { ok: false, reason: "disabled" };
  }

  const importResult = await runGreenhouseImporter();
  // runGreenhouseImporter independently re-derives eligibility from the
  // same registry (enabled + Greenhouse hostname) for EVERY enabled ATS
  // source, not just this one — its results array has one entry per
  // source it actually considered eligible. If this exact sourceId has
  // no entry, it means the importer's own (unmodified, authoritative)
  // check disagrees that this row is a real, eligible Greenhouse board
  // — e.g. this id belongs to a non-Greenhouse-shaped source, or it
  // stopped being eligible between the check above and now (a genuine
  // race). Stop safely rather than guessing.
  const sourceResult = importResult.results.find((r) => r.sourceId === sourceId);
  if (!sourceResult) {
    return { ok: false, reason: "not_a_greenhouse_source" };
  }
  if (!sourceResult.success) {
    return { ok: false, reason: "fetch_failed", detail: sourceResult.error };
  }

  const rawJobs = sourceResult.jobs;
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

  // Sequential, one job at a time — never Promise.all — matching
  // syncAdzunaJobs.ts's own "never burst OpenAI" convention exactly.
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
    // the AI call entirely, matching syncAdzunaJobs.ts's own rule.
    const normalization: NormalizeImportedJobResult =
      duplicate.outcome === "exact_duplicate"
        ? { ok: false, error: "Skipped AI normalization: exact duplicate of an already-processed listing." }
        : await normalizeImportedJob(rawJob);

    // No Greenhouse-specific post-processing exists (unlike Adzuna's 3
    // Adzuna-only optimizations) — Greenhouse's full-HTML descriptions
    // and known-good location text have not been observed to need any
    // source-specific discount/strip/override. If a genuine Greenhouse-
    // specific false positive is ever found in real data, it belongs
    // here as its own narrow, documented function, exactly like
    // syncAdzunaJobs.ts's own three — never in the shared pipeline.
    const decision = decideImportedJobConfidence({
      validation,
      duplicate,
      normalization,
      sourceEligible: true,
    });

    const result = await ingestImportedJob({ rawJob, normalization, decision });
    logSyncResult(rawJob.sourceId, rawJob.externalJobId, result.outcome);

    if (result.outcome === "published") publishedCount += 1;
    else if (result.outcome === "queued_for_review") queuedForReviewCount += 1;
    else if (result.outcome === "rejected") rejectedCount += 1;
    else failedCount += 1;
  }

  return {
    ok: true,
    sourceId: source.id,
    sourceName: source.name,
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
 * syncAdzunaJobs.ts's own logSyncResult exactly.
 */
function logSyncResult(sourceId: string, externalJobId: string, outcome: string): void {
  console.log(JSON.stringify({ event: "greenhouse_sync_job_result", sourceId, externalJobId, outcome }));
}

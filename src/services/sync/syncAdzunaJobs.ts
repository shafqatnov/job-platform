import { listJobSources } from "@/services/admin/jobSources";
import { runAdzunaImporter } from "@/services/importers/adzunaImporter";
import { validateImportedJob } from "@/services/validation/validateImportedJob";
import { detectImportedJobDuplicates } from "@/services/deduplication/detectImportedJobDuplicates";
import { normalizeImportedJob, type NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
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
 * HARD GATE (re-checked here, independent of runAdzunaImporter's own
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

export async function syncAdzunaJobs(): Promise<SyncAdzunaJobsResult> {
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

  const importResult = await runAdzunaImporter();
  // runAdzunaImporter independently re-derives eligibility from the
  // same registry (enabled + Adzuna hostname) — if that disagrees with
  // the check above (a genuine race between two overlapping calls),
  // stop safely rather than processing a partial/stale result.
  if (!importResult.totalSourcesEligible) {
    return { ok: false, reason: "disabled" };
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
    const normalization: NormalizeImportedJobResult =
      duplicate.outcome === "exact_duplicate"
        ? { ok: false, error: "Skipped AI normalization: exact duplicate of an already-processed listing." }
        : await normalizeImportedJob(rawJob);

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

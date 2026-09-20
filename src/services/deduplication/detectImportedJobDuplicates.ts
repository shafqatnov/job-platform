/**
 * Deterministic duplicate-detection stage for already-validated imported
 * jobs. Sits strictly between validation and the future AI/confidence
 * stages:
 *
 *   Validation -> Duplicate Detection (this file) -> AI Normalization
 *   (future) -> Confidence Decision (future) -> Auto Publish / Admin
 *   Review (future)
 *
 * Read-only: this module never creates, updates, or deletes a Job row
 * (or any other row). It only reads existing Job data to compare
 * against. No AI, no fuzzy/probabilistic matching, no new similarity
 * score — every rule here is an exact, deterministic comparison.
 *
 * ---------------------------------------------------------------------
 * IMPORTANT SCHEMA LIMITATION (read before extending this module):
 *
 * The `Job` model has no field that persists an imported job's external
 * identity (no `externalJobId`, no `sourceId`/AuthorizedJobSource
 * reference, no `sourceUrl`). `Job.source` is an unrelated existing enum
 * with a single value today (`employer_direct`) and `Job.duplicateOfJobId`
 * is an unrelated existing self-reference used for flagging one
 * employer-submitted Job as a duplicate of another Job already in the
 * system — neither was designed for, or is reused for, tracking
 * "this Job was imported from external source X as external job Y".
 *
 * Consequence: exact-source-identity (sourceId + externalJobId) matching
 * is only possible WITHIN a single batch passed to this function in one
 * call — it cannot detect that the same external job was already
 * imported and published in a PREVIOUS run, because that fact is never
 * persisted anywhere. This is a genuine limitation, not a bug in this
 * module.
 *
 * No schema change was made in this task, because nothing has ever been
 * published from an import (no AuthorizedJobSource has been enabled),
 * so there is currently no real data such a change would need to
 * protect, and this task's own scope stops at duplicate detection, not
 * publishing. The smallest production-safe addition for a FUTURE task
 * that needs true cross-run idempotency would be two nullable columns on
 * Job — e.g. `importedSourceId String?` and `importedExternalJobId
 * String?` — plus a partial unique index such as
 * `@@unique([importedSourceId, importedExternalJobId])` (allowing many
 * NULLs for employer-direct jobs) so a repeat import can never create a
 * second row for the same external job at the database level, not just
 * in application code.
 * ---------------------------------------------------------------------
 */

import { prisma } from "@/lib/prisma";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";

export type DuplicateDetectionOutcome = "unique" | "exact_duplicate" | "possible_duplicate";

export type DuplicateMatchReference =
  | { kind: "existing_job"; jobId: string }
  | { kind: "batch_record"; sourceId: string; externalJobId: string };

export type DuplicateDetectionResult<T extends ValidatableRawJob = ValidatableRawJob> = {
  outcome: DuplicateDetectionOutcome;
  /** Machine-readable, e.g. "exact_source_identity_within_batch" — null only when outcome is "unique". */
  reason: string | null;
  matchedWith: DuplicateMatchReference | null;
  /** The exact same object reference passed in — never mutated. */
  job: T;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isSameSourceIdentity(
  a: Pick<ValidatableRawJob, "sourceId" | "externalJobId">,
  b: Pick<ValidatableRawJob, "sourceId" | "externalJobId">
): boolean {
  return a.sourceId.trim() === b.sourceId.trim() && a.externalJobId.trim() === b.externalJobId.trim();
}

/**
 * Deterministic, non-fuzzy field comparison — every one of title,
 * company identity, and location must be present and match exactly
 * (after trim/case normalization) for this to report a match. A missing
 * companyIdentity or location on either side means this rule simply does
 * not apply (never guessed, never defaulted).
 */
function isDeterministicFieldMatch(
  job: Pick<ValidatableRawJob, "title" | "companyIdentity" | "location">,
  candidate: { title: string; companyName: string | null; locationName: string | null }
): boolean {
  if (!job.companyIdentity || !job.location || !candidate.companyName || !candidate.locationName) {
    return false;
  }
  return (
    normalize(job.title) === normalize(candidate.title) &&
    normalize(job.companyIdentity) === normalize(candidate.companyName) &&
    normalize(job.location) === normalize(candidate.locationName)
  );
}

/**
 * Reads real, non-deleted Job rows whose title matches (case-insensitive)
 * and checks the deterministic company+location rule against each
 * candidate's real Company.name / City.name. Soft-deleted jobs
 * (deletedAt set) are excluded — matching this codebase's existing
 * convention (createJob.ts's own slug-collision check does the same) —
 * but every other status (pending_review, active, expired, closed,
 * rejected) is included: a previously rejected or expired posting is
 * still evidence this exact job already exists in Jobnura, and silently
 * re-importing it as if new would defeat the purpose of this stage.
 * Read-only — no write of any kind.
 */
async function findDeterministicMatchInDatabase(
  job: Pick<ValidatableRawJob, "title" | "companyIdentity" | "location">
): Promise<string | null> {
  const title = job.title.trim();
  if (!title || !job.companyIdentity || !job.location) {
    return null;
  }

  const candidates = await prisma.job.findMany({
    where: { title: { equals: title, mode: "insensitive" }, deletedAt: null },
    select: { id: true, title: true, company: { select: { name: true } }, city: { select: { name: true } } },
  });

  const match = candidates.find((candidate) =>
    isDeterministicFieldMatch(job, {
      title: candidate.title,
      companyName: candidate.company.name,
      locationName: candidate.city.name,
    })
  );

  return match ? match.id : null;
}

/**
 * Detects duplicates within a batch of already-validated imported jobs.
 * Processes each job in order, comparing it against jobs already seen
 * earlier in the same call and against real existing Job rows in the
 * database. Never writes anything. Deterministic and idempotent: the
 * same input jobs against the same database state always produce the
 * same result.
 */
export async function detectImportedJobDuplicates<T extends ValidatableRawJob>(
  jobs: T[]
): Promise<DuplicateDetectionResult<T>[]> {
  const results: DuplicateDetectionResult<T>[] = [];
  const seenInBatch: T[] = [];

  for (const job of jobs) {
    const exactBatchMatch = seenInBatch.find((prior) => isSameSourceIdentity(prior, job));
    if (exactBatchMatch) {
      results.push({
        outcome: "exact_duplicate",
        reason: "exact_source_identity_within_batch",
        matchedWith: {
          kind: "batch_record",
          sourceId: exactBatchMatch.sourceId,
          externalJobId: exactBatchMatch.externalJobId,
        },
        job,
      });
      seenInBatch.push(job);
      continue;
    }

    const batchFieldMatch = seenInBatch.find((prior) =>
      isDeterministicFieldMatch(job, {
        title: prior.title,
        companyName: prior.companyIdentity,
        locationName: prior.location,
      })
    );
    if (batchFieldMatch) {
      results.push({
        outcome: "possible_duplicate",
        reason: "deterministic_title_company_location_match_within_batch",
        matchedWith: {
          kind: "batch_record",
          sourceId: batchFieldMatch.sourceId,
          externalJobId: batchFieldMatch.externalJobId,
        },
        job,
      });
      seenInBatch.push(job);
      continue;
    }

    const existingJobId = await findDeterministicMatchInDatabase(job);
    if (existingJobId) {
      results.push({
        outcome: "possible_duplicate",
        reason: "deterministic_title_company_location_match_existing_job",
        matchedWith: { kind: "existing_job", jobId: existingJobId },
        job,
      });
      seenInBatch.push(job);
      continue;
    }

    results.push({ outcome: "unique", reason: null, matchedWith: null, job });
    seenInBatch.push(job);
  }

  return results;
}

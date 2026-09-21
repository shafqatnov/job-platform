"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { syncGreenhouseJobs } from "@/services/sync/syncGreenhouseJobs";

export type SyncGreenhouseNowSummary = {
  imported: number;
  published: number;
  adminReview: number;
  duplicates: number;
  rejected: number;
  durationMs: number;
};

export type SyncGreenhouseNowActionState = {
  error?: string;
  summary?: SyncGreenhouseNowSummary;
};

/**
 * In-process only — same honest, already-disclosed limitation as
 * syncAdzunaNowAction.ts's own guard (not a correct guarantee across
 * multiple server instances, but a real, effective guard for this
 * project's current single-process deployment). A SINGLE, GLOBAL lock
 * shared across every Greenhouse source rather than one lock per
 * source: syncGreenhouseJobs() calls the existing runGreenhouseImporter,
 * which itself fetches every enabled Greenhouse board in one pass, so
 * two "Sync Now" clicks on two DIFFERENT employer boards at the same
 * moment would still both trigger that same shared fetch redundantly —
 * this lock prevents that overlap exactly like Adzuna's own lock
 * prevents a double-click, just scoped to "any Greenhouse sync" rather
 * than "any Adzuna sync" (there is only ever one Adzuna source, so the
 * two are equivalent in spirit).
 */
let syncInProgress = false;

/**
 * The manual "Sync Now" admin action for one specific Greenhouse
 * employer-board source — re-derives the acting admin from the session
 * on every submit (never trusts client input), exactly like
 * syncAdzunaNowAction.ts. Calls the EXISTING syncGreenhouseJobs(sourceId)
 * unchanged — this file adds no new pipeline logic, no new Greenhouse/AI/
 * publishing behavior. syncGreenhouseJobs() itself independently
 * re-verifies the target source's authorizationStatus/enabled state
 * before ever calling Greenhouse or publishing anything — this action
 * does not duplicate or bypass that gate, it only surfaces the result.
 *
 * Bound to a specific sourceId by the caller (JobSourcesTable.tsx), the
 * same way setJobSourceEnabledAction/setJobSourceAuthorizationAction are
 * already bound per-row — sourceId is never read from client-supplied
 * form data.
 */
export async function syncGreenhouseNowAction(
  sourceId: string,
  // Required by useActionState's action signature, matching
  // syncAdzunaNowAction.ts's own convention.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: SyncGreenhouseNowActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<SyncGreenhouseNowActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  if (syncInProgress) {
    return { error: "A sync is already running. Please wait for it to finish before starting another." };
  }

  syncInProgress = true;
  const startedAt = Date.now();
  try {
    const result = await syncGreenhouseJobs(sourceId);

    if (!result.ok) {
      const detail = "detail" in result && result.detail ? ` (${result.detail})` : "";
      return { error: `Sync did not run: this source is currently "${result.reason}"${detail}.` };
    }

    revalidatePath("/admin/job-sources");
    return {
      summary: {
        imported: result.fetchedCount,
        published: result.publishedCount,
        adminReview: result.queuedForReviewCount,
        duplicates: result.exactDuplicateCount + result.possibleDuplicateCount,
        // Folds every non-published, non-review outcome into one simple
        // "Rejected" figure for this admin-facing summary, matching
        // syncAdzunaNowAction.ts's own convention — never raw JSON,
        // never a breakdown that would require exposing internal reason
        // codes.
        rejected: result.rejectedCount + result.failedCount + result.invalidCount,
        durationMs: Date.now() - startedAt,
      },
    };
  } finally {
    syncInProgress = false;
  }
}

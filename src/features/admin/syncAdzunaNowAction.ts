"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { syncAdzunaJobs } from "@/services/sync/syncAdzunaJobs";

export type SyncAdzunaNowSummary = {
  imported: number;
  published: number;
  adminReview: number;
  duplicates: number;
  rejected: number;
  durationMs: number;
};

export type SyncAdzunaNowActionState = {
  error?: string;
  summary?: SyncAdzunaNowSummary;
};

/**
 * In-process only — same honest, already-disclosed limitation as
 * secureTrigger.ts's own rate limiter (not a correct guarantee across
 * multiple server instances, but a real, effective guard for this
 * project's current single-process deployment). Prevents a second
 * "Sync Now" click (a genuine double-click, or two browser tabs) from
 * starting an overlapping Adzuna sync while one is already running —
 * React's own useActionState pending-state disabling the button is the
 * first line of defense on the client; this is the server-side backstop.
 */
let syncInProgress = false;

/**
 * The manual "Sync Now" admin action — re-derives the acting admin from
 * the session on every submit (never trusts client input), exactly like
 * setJobSourceEnabledAction.ts/setJobSourceAuthorizationAction.ts. Calls
 * the EXISTING syncAdzunaJobs() unchanged — this file adds no new
 * pipeline logic, no new Adzuna/AI/publishing behavior, and no new sync
 * limit: syncAdzunaJobs() and everything it calls (the importer's own
 * country scope and 20-listing cap, validation, duplicate detection, AI
 * normalization, confidence decision, publishing) are entirely reused
 * as-is. syncAdzunaJobs() itself independently re-verifies the Adzuna
 * source's authorizationStatus/enabled state before ever calling Adzuna
 * or publishing anything — this action does not duplicate or bypass
 * that gate, it only surfaces the result.
 */
export async function syncAdzunaNowAction(
  // Required by useActionState's action signature, matching
  // approveJobAction.ts's own convention.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: SyncAdzunaNowActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<SyncAdzunaNowActionState> {
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
    const result = await syncAdzunaJobs();

    if (!result.ok) {
      return { error: `Sync did not run: the Adzuna source is currently "${result.reason}".` };
    }

    revalidatePath("/admin/job-sources");
    return {
      summary: {
        imported: result.fetchedCount,
        published: result.publishedCount,
        adminReview: result.queuedForReviewCount,
        duplicates: result.exactDuplicateCount + result.possibleDuplicateCount,
        // Folds every non-published, non-review outcome (explicit
        // do_not_publish rejections, structural validation failures,
        // and technical publish failures) into one simple "Rejected"
        // figure for this admin-facing summary — never raw JSON, never
        // a breakdown that would require exposing internal reason codes.
        rejected: result.rejectedCount + result.failedCount + result.invalidCount,
        durationMs: Date.now() - startedAt,
      },
    };
  } finally {
    syncInProgress = false;
  }
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { syncAdzunaNowAction, type SyncAdzunaNowActionState } from "@/features/admin/syncAdzunaNowAction";

const initialState: SyncAdzunaNowActionState = {};

export type AdzunaSyncNowButtonProps = {
  /** True only when the Adzuna source is both authorizationStatus === "verified" and enabled === true. */
  isEligible: boolean;
};

/**
 * Manual "Sync Now" trigger for the Adzuna source only — runs exactly
 * one existing syncAdzunaJobs() pass via syncAdzunaNowAction.ts. Shown
 * (disabled, with an explanation) rather than hidden when the source
 * isn't both verified and enabled, matching this table's own existing
 * pattern for the "Enable" button.
 */
export function AdzunaSyncNowButton({ isEligible }: AdzunaSyncNowButtonProps) {
  const [state, formAction, isPending] = useActionState(syncAdzunaNowAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="submit" variant="outline" size="sm" disabled={isPending || !isEligible}>
        {isPending ? "Syncing…" : "🔄 Sync Now"}
      </Button>
      {!isEligible ? (
        <p className="text-sm text-muted-foreground">Requires verified authorization and enabled status.</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.error}
        </p>
      ) : null}
      {state.summary ? (
        <dl className="flex flex-col items-start gap-0.5 text-sm text-muted-foreground sm:items-end">
          <div>
            <dt className="inline font-medium text-foreground">Imported:</dt> <dd className="inline">{state.summary.imported}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Published:</dt> <dd className="inline">{state.summary.published}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Admin Review:</dt> <dd className="inline">{state.summary.adminReview}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Duplicates:</dt> <dd className="inline">{state.summary.duplicates}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Rejected:</dt> <dd className="inline">{state.summary.rejected}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Duration:</dt>{" "}
            <dd className="inline">{(state.summary.durationMs / 1000).toFixed(1)}s</dd>
          </div>
        </dl>
      ) : null}
    </form>
  );
}

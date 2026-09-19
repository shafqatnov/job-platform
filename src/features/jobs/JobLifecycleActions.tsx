"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { closeJobAction, type CloseJobActionState } from "@/features/jobs/closeJobAction";
import { reopenJobAction, type ReopenJobActionState } from "@/features/jobs/reopenJobAction";
import { deleteJobAction, type DeleteJobActionState } from "@/features/jobs/deleteJobAction";
import type { JobStatus } from "@/generated/prisma/enums";

export type JobLifecycleActionsProps = {
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: JobStatus;
  /** Whether this job has any Application or SavedJob row — see deleteJob.ts. */
  canDelete: boolean;
};

const initialCloseState: CloseJobActionState = {};
const initialReopenState: ReopenJobActionState = {};
const initialDeleteState: DeleteJobActionState = {};

/**
 * Employer-facing lifecycle controls for one job. Only shows the
 * actions that are safe for the CURRENT status (per this task's Part 2
 * capability table) — the server-side services re-check everything
 * regardless, this is UX only, exactly like ApplyButton.tsx/
 * SaveJobButton.tsx's own documented split between "what's shown" and
 * "what's actually authorized."
 *
 * Delete uses an inline, in-page confirmation panel rather than
 * `window.confirm()` (this task explicitly requires that), showing the
 * job title/company and an explicit "cannot be undone" warning before
 * the real delete action ever fires.
 */
export function JobLifecycleActions({ jobId, jobTitle, companyName, status, canDelete }: JobLifecycleActionsProps) {
  const [closeState, closeFormAction, isClosing] = useActionState(closeJobAction.bind(null, jobId), initialCloseState);
  const [reopenState, reopenFormAction, isReopening] = useActionState(
    reopenJobAction.bind(null, jobId),
    initialReopenState
  );
  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    deleteJobAction.bind(null, jobId),
    initialDeleteState
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canEdit = status === "pending_review" || status === "active";
  const canClose = status === "active";
  const canReopen = status === "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link href={`/employer/jobs/${jobId}/edit`} className="inline-flex">
            <Button type="button" variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        ) : null}

        {canClose ? (
          <form action={closeFormAction}>
            <Button type="submit" variant="outline" size="sm" disabled={isClosing}>
              {isClosing ? "Closing…" : "Close Job"}
            </Button>
          </form>
        ) : null}

        {canReopen ? (
          <form action={reopenFormAction}>
            <Button type="submit" variant="outline" size="sm" disabled={isReopening}>
              {isReopening ? "Reopening…" : "Reopen Job"}
            </Button>
          </form>
        ) : null}

        {canDelete && !showDeleteConfirm ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            Delete Job
          </Button>
        ) : null}
      </div>

      {closeState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {closeState.error}
        </p>
      ) : null}
      {reopenState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {reopenState.error}
        </p>
      ) : null}

      {!canDelete ? (
        <p className="text-sm text-muted-foreground">
          This job cannot be permanently deleted because it has associated application data. You can close the job
          instead.
        </p>
      ) : null}

      {canDelete && showDeleteConfirm ? (
        <div className="flex flex-col gap-3 rounded-md border border-danger-600 bg-danger-50 p-4 dark:bg-danger-500/10">
          <p className="font-medium text-foreground">Delete this job permanently?</p>
          <dl className="text-sm text-foreground">
            <div>
              <dt className="inline text-muted-foreground">Job: </dt>
              <dd className="inline">{jobTitle}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Company: </dt>
              <dd className="inline">{companyName}</dd>
            </div>
          </dl>
          <p className="text-sm font-medium text-danger-600">This action cannot be undone.</p>
          <div className="flex gap-3">
            <form action={deleteFormAction}>
              <Button type="submit" variant="primary" size="sm" disabled={isDeleting}>
                {isDeleting ? "Deleting…" : "Yes, delete permanently"}
              </Button>
            </form>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
          {deleteState.error ? (
            <p role="alert" className="text-sm text-danger-600">
              {deleteState.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

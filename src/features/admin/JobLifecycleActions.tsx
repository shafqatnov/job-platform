"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { closeJobAsAdminAction, type CloseJobAsAdminActionState } from "@/features/admin/closeJobAsAdminAction";
import { reopenJobAsAdminAction, type ReopenJobAsAdminActionState } from "@/features/admin/reopenJobAsAdminAction";
import { deleteJobAsAdminAction, type DeleteJobAsAdminActionState } from "@/features/admin/deleteJobAsAdminAction";
import type { JobStatus } from "@/generated/prisma/enums";

export type AdminJobLifecycleActionsProps = {
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: JobStatus;
  canDelete: boolean;
};

const initialCloseState: CloseJobAsAdminActionState = {};
const initialReopenState: ReopenJobAsAdminActionState = {};
const initialDeleteState: DeleteJobAsAdminActionState = {};

/**
 * Admin lifecycle controls for a job that is past the pending_review
 * approve/reject decision (see JobReviewActions.tsx for that separate,
 * untouched flow). Same status-gating and inline (non-native) delete
 * confirmation pattern as src/features/jobs/JobLifecycleActions.tsx —
 * admin's only difference is reach (any job, not just one company's)
 * and that every action here writes a ModerationAction audit entry
 * server-side.
 */
export function AdminJobLifecycleActions({ jobId, jobTitle, companyName, status, canDelete }: AdminJobLifecycleActionsProps) {
  const [closeState, closeFormAction, isClosing] = useActionState(
    closeJobAsAdminAction.bind(null, jobId),
    initialCloseState
  );
  const [reopenState, reopenFormAction, isReopening] = useActionState(
    reopenJobAsAdminAction.bind(null, jobId),
    initialReopenState
  );
  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    deleteJobAsAdminAction.bind(null, jobId),
    initialDeleteState
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canClose = status === "active";
  const canReopen = status === "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
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

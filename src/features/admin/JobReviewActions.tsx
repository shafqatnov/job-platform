"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { approveJobAction, type ApproveJobActionState } from "@/features/admin/approveJobAction";
import { rejectJobAction, type RejectJobActionState } from "@/features/admin/rejectJobAction";

export type JobReviewActionsProps = {
  jobId: string;
};

const initialApproveState: ApproveJobActionState = {};
const initialRejectState: RejectJobActionState = {};

/**
 * The only two actions Phase-1 moderation offers — approve or reject.
 * No editing, no other transitions; each is its own form/action so a
 * race (another admin already decided this job) surfaces its own error
 * without touching the other button's state.
 */
export function JobReviewActions({ jobId }: JobReviewActionsProps) {
  const [approveState, approveFormAction, isApproving] = useActionState(
    approveJobAction.bind(null, jobId),
    initialApproveState
  );
  const [rejectState, rejectFormAction, isRejecting] = useActionState(
    rejectJobAction.bind(null, jobId),
    initialRejectState
  );

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
      <form action={approveFormAction} className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={isApproving || isRejecting}>
          {isApproving ? "Approving…" : "Approve"}
        </Button>
        {approveState.error ? (
          <p role="alert" className="text-sm text-danger-600">
            {approveState.error}
          </p>
        ) : null}
      </form>

      <form action={rejectFormAction} className="flex flex-1 flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Rejection reason (optional)</span>
          <textarea
            name="reason"
            rows={2}
            maxLength={1000}
            className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            placeholder="Shown to the employer, e.g. missing salary details."
          />
        </label>
        <Button type="submit" variant="outline" size="lg" disabled={isApproving || isRejecting}>
          {isRejecting ? "Rejecting…" : "Reject"}
        </Button>
        {rejectState.error ? (
          <p role="alert" className="text-sm text-danger-600">
            {rejectState.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

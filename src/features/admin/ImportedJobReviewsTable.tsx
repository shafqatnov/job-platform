"use client";

import { useActionState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  approveImportedJobReviewAction,
  type ApproveImportedJobReviewActionState,
} from "@/features/admin/approveImportedJobReviewAction";
import {
  rejectImportedJobReviewAction,
  type RejectImportedJobReviewActionState,
} from "@/features/admin/rejectImportedJobReviewAction";
import type { ImportedJobReviewRow } from "@/services/admin/listImportedJobReviews";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const initialApproveState: ApproveImportedJobReviewActionState = {};
const initialRejectState: RejectImportedJobReviewActionState = {};

function ImportedJobReviewCard({ review }: { review: ImportedJobReviewRow }) {
  const [approveState, approveFormAction, isApproving] = useActionState(
    approveImportedJobReviewAction.bind(null, review.id),
    initialApproveState
  );
  const [rejectState, rejectFormAction, isRejecting] = useActionState(
    rejectImportedJobReviewAction.bind(null, review.id),
    initialRejectState
  );

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{review.title}</span>
          <Badge variant={review.decision === "auto_publish" ? "success" : "warning"}>{review.decision}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {review.companyIdentity ?? "Unknown company"} &middot; {review.location ?? "No location provided"}
        </span>
        <span className="text-sm text-muted-foreground">
          Source: {review.importedSourceId} &middot; External ID: {review.importedExternalJobId}
        </span>
        {review.sourceUrl ? (
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View original source listing
          </a>
        ) : null}
        <span className="text-sm text-muted-foreground">
          Category: {review.category ?? "Uncertain"} &middot; Country: {review.country ?? "Uncertain"} &middot; City:{" "}
          {review.city ?? "Not provided"}
        </span>
        {review.reasons.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {review.reasons.map((reason) => (
              <Badge key={reason} variant="neutral">
                {reason}
              </Badge>
            ))}
          </div>
        ) : null}
        <span className="text-sm text-muted-foreground">
          Imported {dateFormatter.format(new Date(review.createdAt))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={approveFormAction}>
          <Button type="submit" size="sm" disabled={isApproving || isRejecting}>
            {isApproving ? "Approving…" : "Approve / Publish"}
          </Button>
        </form>
        <form action={rejectFormAction}>
          <Button type="submit" variant="outline" size="sm" disabled={isApproving || isRejecting}>
            {isRejecting ? "Rejecting…" : "Reject / Do Not Publish"}
          </Button>
        </form>
      </div>
      {approveState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {approveState.error}
        </p>
      ) : null}
      {approveState.info ? (
        <p role="status" className="text-sm text-warning-700">
          {approveState.info}
        </p>
      ) : null}
      {rejectState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {rejectState.error}
        </p>
      ) : null}
    </li>
  );
}

export type ImportedJobReviewsTableProps = {
  reviews: ImportedJobReviewRow[];
};

export function ImportedJobReviewsTable({ reviews }: ImportedJobReviewsTableProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No imported jobs need review"
        description="Jobs the confidence-decision stage flags for review will appear here."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {reviews.map((review) => (
        <ImportedJobReviewCard key={review.id} review={review} />
      ))}
    </ul>
  );
}

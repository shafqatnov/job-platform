import type { BadgeVariant } from "@/components/Badge";
import type { JobStatus } from "@/generated/prisma/enums";

/**
 * Single shared status → label/variant mapping, used by both the
 * employer dashboard ("My Jobs") and the admin job lists — one place so
 * the two surfaces never drift into inconsistent wording for the same
 * lifecycle state (see docs/18-job-lifecycle.md).
 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending_review: "Pending review",
  active: "Active",
  expired: "Expired",
  closed: "Closed",
  rejected: "Rejected",
};

export const JOB_STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  pending_review: "warning",
  active: "success",
  expired: "neutral",
  closed: "neutral",
  rejected: "danger",
};

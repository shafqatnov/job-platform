import type { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Display labels for ApplicationStatus. The schema currently defines
 * only `received` — docs/20-application-flow.md explicitly defers
 * "multi-stage applicant pipeline statuses beyond 'received' (e.g.
 * shortlisted, interviewing, rejected)" as a later, undecided
 * enhancement, not a launch requirement. "Applied" is simply this
 * task's requested display label for that one real state; it is not a
 * second status value, and no Reviewed/Rejected/Hired transition exists
 * anywhere in this codebase (there is nowhere that could set them).
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  received: "Applied",
};

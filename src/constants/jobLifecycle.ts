/**
 * docs/18-job-lifecycle.md's recommended default listing duration —
 * shared by every path that transitions a job to `active` (human-admin
 * approval and, now, the automated moderation pipeline) so the business
 * rule is defined exactly once.
 */
export const LISTING_DURATION_DAYS = 30;

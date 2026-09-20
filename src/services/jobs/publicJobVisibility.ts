import type { Prisma } from "@/generated/prisma/client";

/**
 * Explicit, exact disposable-test-fixture title markers — never a
 * keyword or substring rule. A job whose title merely CONTAINS "test"
 * or "qa" (e.g. "Test Automation Engineer", "QA Test Engineer", "Test
 * Inspector") is an entirely ordinary, legitimate title and must never
 * be excluded here — only an exact PREFIX match against one of these
 * specific, deliberately bracketed markers ever excludes a job.
 *
 * Confirmed via this repository's own test fixtures AND a direct
 * database audit (this task) of real leftover rows a flaky test run
 * left behind:
 *  - "[IMPORT TEST]" — src/services/publishing/publishImportedJob.test.ts's
 *    fixture prefix, found on real `status: active` Job rows that had
 *    leaked onto the public site.
 *  - "[LOCATION REVIEW TEST]" — src/services/admin/locationReviews.test.ts's
 *    fixture prefix, found on a real leftover Job row the same way.
 *
 * Deliberately NOT included: "[AI MODERATION TEST]"
 * (src/test-utils/moderationFixtures.ts's TEST_LABEL_PREFIX). Dozens of
 * existing tests — most directly, getPublicJobs.test.ts itself — create
 * `active` jobs with this exact prefix and assert they DO appear in
 * public results; excluding it here would break those already-passing
 * tests. A database audit also found zero leftover "[AI MODERATION
 * TEST]" jobs (unlike the two markers above), so it isn't the source of
 * the reported production issue. If hiding it from public listings is
 * ever wanted too, that requires deliberately updating
 * getPublicJobs.test.ts's own fixtures first, not a silent addition here.
 */
const TEST_FIXTURE_TITLE_MARKERS = ["[IMPORT TEST]", "[LOCATION REVIEW TEST]"] as const;

/**
 * The single centralized Prisma where-fragment for "is this Job
 * currently visible on any PUBLIC surface." Every public listing query
 * (getPublicJobs.ts, getPublicJobBySlug.ts, getPublicJobsForSitemap.ts)
 * combines this into its own where clause — via `AND: [publicJobVisibilityWhere(), ...]` —
 * rather than re-deriving the rule, so a future change to what counts as
 * "publicly visible" only needs to happen once.
 *
 * Combines the existing lifecycle rule (status = active, not
 * soft-deleted, not past its expiry date — see docs/18-job-lifecycle.md)
 * with an explicit exclusion of the confirmed disposable test-fixture
 * markers above, so a leftover fixture can never surface publicly even
 * if its status is somehow "active".
 */
export function publicJobVisibilityWhere(now: Date = new Date()): Prisma.JobWhereInput {
  return {
    status: "active",
    deletedAt: null,
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { NOT: { OR: TEST_FIXTURE_TITLE_MARKERS.map((marker) => ({ title: { startsWith: marker } })) } },
    ],
  };
}

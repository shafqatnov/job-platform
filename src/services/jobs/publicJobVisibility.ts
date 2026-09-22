import type { Prisma } from "@/generated/prisma/client";

/**
 * Explicit, exact disposable-test-fixture title markers — never a
 * keyword or substring rule. A job whose title merely CONTAINS "test"
 * or "qa" (e.g. "Test Automation Engineer", "QA Test Engineer", "Test
 * Inspector") is an entirely ordinary, legitimate title and must never
 * be excluded here — only an exact PREFIX match against one of these
 * specific, deliberately bracketed markers ever excludes a job.
 *
 * This list only covers fixtures published under the real, permanent
 * `imports@jobnura.internal` system user (src/services/publishing/
 * publishImportedJob.ts) — those never carry a disposable
 * `@example.invalid` poster, so DISPOSABLE_TEST_POSTER_EMAIL_SUFFIX
 * below can't catch them, and title-matching is the only signal
 * available:
 *  - "[IMPORT TEST]" — src/services/publishing/publishImportedJob.test.ts's
 *    fixture prefix, found on real `status: active` Job rows that had
 *    leaked onto the public site.
 *  - "[LOCATION REVIEW TEST]" — src/services/admin/locationReviews.test.ts's
 *    fixture prefix, found on a real leftover Job row the same way.
 *  - "[GH LOCATION WIRING TEST]" — an ATS location-review-wiring
 *    fixture prefix used in src/services/publishing. No test asserts
 *    this title is ever publicly visible, so — unlike "[AI MODERATION
 *    TEST]" below — adding it here is safe. A database audit (this
 *    task) found two leftover rows using it, both still
 *    `pending_review` (so not currently live), but nothing previously
 *    stopped a future orphaned row of this same family from reaching
 *    `active` and leaking exactly like the two markers above did.
 *
 * Deliberately NOT included: "[AI MODERATION TEST]"
 * (src/test-utils/moderationFixtures.ts's TEST_LABEL_PREFIX). Dozens of
 * existing tests — most directly, getPublicJobs.test.ts itself — create
 * `active` jobs with this exact prefix and assert they DO appear in
 * public results; excluding it here would break those already-passing
 * tests. This family is instead covered structurally, below.
 */
const TEST_FIXTURE_TITLE_MARKERS = ["[IMPORT TEST]", "[LOCATION REVIEW TEST]", "[GH LOCATION WIRING TEST]"] as const;

/**
 * Every disposable test fixture across this codebase's test suite
 * (src/test-utils/moderationFixtures.ts, candidateFixtures.ts, and ~30
 * other test files — never just the AI-moderation suite) posts as a
 * throwaway User created with an email on this reserved, non-routable
 * domain (RFC 2606) — never a real signup. Each test's own
 * afterEach/afterAll deletes these fixtures within seconds, but a test
 * process that crashes or times out (confirmed this task: repeated
 * Prisma/Neon connection-drop and hook-timeout failures under DB
 * contention) skips that cleanup, leaving the row behind indefinitely.
 * Because "[AI MODERATION TEST]" jobs must stay visible for the handful
 * of seconds an in-progress test actually runs (see above), this can't
 * be a title rule — instead, a Job posted by one of these throwaway
 * users becomes excluded only once it has clearly outlived any real
 * test run.
 */
const DISPOSABLE_TEST_POSTER_EMAIL_SUFFIX = "@example.invalid";

/**
 * A real, single test/hook never takes anywhere near this long (the
 * suite's own hook timeout is 20 seconds); this is a wide, deliberately
 * generous safety margin so no in-progress test can ever be affected,
 * while an orphaned fixture from a crashed run is excluded almost
 * immediately in practical terms.
 */
const ORPHANED_TEST_FIXTURE_MAX_AGE_MS = 60 * 60 * 1000;

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
 * with two independent disposable-fixture exclusions: the title-marker
 * list above (for fixtures posted by the real import-system user), and
 * the poster-email-age check (for fixtures posted by a throwaway
 * `@example.invalid` user) — so a leftover fixture from either family
 * can never surface publicly even if its status is somehow "active".
 */
export function publicJobVisibilityWhere(now: Date = new Date()): Prisma.JobWhereInput {
  return {
    status: "active",
    deletedAt: null,
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { NOT: { OR: TEST_FIXTURE_TITLE_MARKERS.map((marker) => ({ title: { startsWith: marker } })) } },
      {
        NOT: {
          AND: [
            { postedBy: { email: { endsWith: DISPOSABLE_TEST_POSTER_EMAIL_SUFFIX } } },
            { createdAt: { lt: new Date(now.getTime() - ORPHANED_TEST_FIXTURE_MAX_AGE_MS) } },
          ],
        },
      },
    ],
  };
}

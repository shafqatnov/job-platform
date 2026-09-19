import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { expireDueJobs } from "@/services/jobs/expireJobs";
import { applyToJob } from "@/services/applications/applyToJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";
import { createCandidateTestFixtures, cleanupCandidateTestFixtures } from "@/test-utils/candidateFixtures";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

/**
 * expireDueJobs() operates on the whole Job table (by design — see its
 * own doc comment), not a single row, so these tests use a real
 * dev-database fixture and only assert on THIS fixture's own job plus
 * revalidatePath's call count, never on the total number of jobs
 * expired — the real "Senior Petroleum Engineer" listing was approved
 * recently and its expiresAt is 30 days out, well outside any risk of
 * being touched by this test.
 */
describe("expireDueJobs revalidation (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterEach(() => {
    revalidatePathMock.mockClear();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("expires a past-due active job and revalidates /jobs and /", async () => {
    const job = await createTestJob(fixtures, {
      status: "active",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const result = await expireDueJobs();

    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(updated.status).toBe("expired");

    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("does NOT revalidate when no job is currently due", async () => {
    // Nothing due right now: this fixture job isn't expired, and the
    // previous test's fixture job was already transitioned to
    // "expired" (so it no longer matches the active+past-due predicate).
    const job = await createTestJob(fixtures, {
      status: "active",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expireDueJobs();

    // Not asserting a global expiredCount of exactly 0 here — this
    // function scans the whole table by design, so the only thing this
    // test can safely guarantee is THIS fixture's own row and whether
    // revalidation happened as a direct consequence of THIS call.
    expect(revalidatePathMock).not.toHaveBeenCalled();

    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(unchanged.status).toBe("active");
  });

  it("expires the correct eligible job while leaving an unrelated, not-yet-due job unchanged in the same run", async () => {
    const dueJob = await createTestJob(fixtures, {
      status: "active",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const notDueJob = await createTestJob(fixtures, {
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expireDueJobs();

    const [dueResult, notDueResult] = await Promise.all([
      prisma.job.findUniqueOrThrow({ where: { id: dueJob.id }, select: { status: true } }),
      prisma.job.findUniqueOrThrow({ where: { id: notDueJob.id }, select: { status: true } }),
    ]);
    expect(dueResult.status).toBe("expired");
    expect(notDueResult.status).toBe("active");
  });

  it("preserves an existing application after its job expires", async () => {
    const candidate = await createCandidateTestFixtures();
    try {
      const job = await createTestJob(fixtures, {
        status: "active",
        applicationMethod: "on_platform",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // not yet due — apply first
      });
      const applyResult = await applyToJob({ userId: candidate.userId, jobId: job.id });
      expect(applyResult.success).toBe(true);

      // Now make it due and expire it.
      await prisma.job.update({ where: { id: job.id }, data: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) } });
      await expireDueJobs();

      const updatedJob = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
      expect(updatedJob.status).toBe("expired");

      const application = await prisma.application.findFirst({ where: { jobId: job.id } });
      expect(application).not.toBeNull();
      expect(application?.deletedAt).toBeNull();
    } finally {
      await cleanupCandidateTestFixtures(candidate);
    }
  });
});

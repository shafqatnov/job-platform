import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteJob } from "@/services/jobs/deleteJob";
import { applyToJob } from "@/services/applications/applyToJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";
import {
  createCandidateTestFixtures,
  cleanupCandidateTestFixtures,
  type CandidateTestFixtures,
} from "@/test-utils/candidateFixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("deleteJob (real dev database, temporary fixtures)", () => {
  let employerA: ModerationTestFixtures;
  let employerB: ModerationTestFixtures;
  let candidate: CandidateTestFixtures;

  beforeAll(async () => {
    employerA = await createModerationTestFixtures();
    employerB = await createModerationTestFixtures();
    candidate = await createCandidateTestFixtures();
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidate);
    await cleanupModerationTestFixtures(employerA);
    await cleanupModerationTestFixtures(employerB);
  });

  it("employer can permanently delete their own job with no applications or saved-job bookmarks", async () => {
    const job = await createTestJob(employerA, { status: "pending_review" });

    const result = await deleteJob(employerA.userId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { deletedAt: true } });
    expect(updated.deletedAt).not.toBeNull();
  });

  it("employer cannot permanently delete a job that has an application, and the job/application both remain intact", async () => {
    const job = await createTestJob(employerA, {
      status: "active",
      applicationMethod: "on_platform",
      title: "[AI MODERATION TEST] Job With Application",
    });
    const applyResult = await applyToJob({ userId: candidate.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);

    const result = await deleteJob(employerA.userId, job.id);

    expect(result).toEqual({
      success: false,
      error: "This job cannot be permanently deleted because it has associated application data. You can close the job instead.",
    });

    const unchangedJob = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { deletedAt: true } });
    expect(unchangedJob.deletedAt).toBeNull();
    const applicationCount = await prisma.application.count({ where: { jobId: job.id } });
    expect(applicationCount).toBe(1);
  });

  it("employer cannot delete another employer's job", async () => {
    const job = await createTestJob(employerB, { status: "pending_review" });

    const result = await deleteJob(employerA.userId, job.id);

    expect(result).toEqual({ success: false, error: "Job not found." });
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { deletedAt: true } });
    expect(unchanged.deletedAt).toBeNull();
  });
});

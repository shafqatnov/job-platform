import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeJob } from "@/services/jobs/closeJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("closeJob (real dev database, temporary fixtures)", () => {
  let employerA: ModerationTestFixtures;
  let employerB: ModerationTestFixtures;

  beforeAll(async () => {
    employerA = await createModerationTestFixtures();
    employerB = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(employerA);
    await cleanupModerationTestFixtures(employerB);
  });

  it("employer can close their own active job", async () => {
    const job = await createTestJob(employerA, { status: "active" });

    const result = await closeJob(employerA.userId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true, closedAt: true } });
    expect(updated.status).toBe("closed");
    expect(updated.closedAt).not.toBeNull();
  });

  it("employer cannot close another employer's job", async () => {
    const job = await createTestJob(employerB, { status: "active" });

    const result = await closeJob(employerA.userId, job.id);

    expect(result).toEqual({ success: false, error: "This job cannot be closed from its current state." });
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(unchanged.status).toBe("active");
  });

  it("cannot close a job that is not currently active", async () => {
    const pendingJob = await createTestJob(employerA, { status: "pending_review" });
    const result = await closeJob(employerA.userId, pendingJob.id);
    expect(result).toEqual({ success: false, error: "This job cannot be closed from its current state." });
  });
});

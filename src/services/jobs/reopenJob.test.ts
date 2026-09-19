import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { reopenJob } from "@/services/jobs/reopenJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("reopenJob (real dev database, temporary fixtures)", () => {
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

  it("employer can reopen their own closed job when it has not expired", async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const job = await createTestJob(employerA, { status: "closed", expiresAt: future });

    const result = await reopenJob(employerA.userId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true, closedAt: true } });
    expect(updated.status).toBe("active");
    expect(updated.closedAt).toBeNull();
  });

  it("employer can reopen a closed job with no expiry set at all", async () => {
    const job = await createTestJob(employerA, { status: "closed", expiresAt: null });
    const result = await reopenJob(employerA.userId, job.id);
    expect(result).toEqual({ success: true });
  });

  it("refuses to reopen a closed job whose listing period has already ended", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const job = await createTestJob(employerA, { status: "closed", expiresAt: past });

    const result = await reopenJob(employerA.userId, job.id);

    expect(result).toEqual({
      success: false,
      error: "This job's listing period has already ended and cannot be reopened.",
    });
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(unchanged.status).toBe("closed");
  });

  it("refuses to reopen an expired job (never reopenable directly — see reopenJob.ts)", async () => {
    const job = await createTestJob(employerA, { status: "expired" });
    const result = await reopenJob(employerA.userId, job.id);
    expect(result).toEqual({ success: false, error: "This job cannot be reopened from its current state." });
  });

  it("refuses to reopen a rejected job (moderation re-review only, not a lifecycle toggle)", async () => {
    const job = await createTestJob(employerA, { status: "rejected" });
    const result = await reopenJob(employerA.userId, job.id);
    expect(result).toEqual({ success: false, error: "This job cannot be reopened from its current state." });
  });

  it("employer cannot reopen another employer's job", async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const job = await createTestJob(employerB, { status: "closed", expiresAt: future });

    const result = await reopenJob(employerA.userId, job.id);

    expect(result).toEqual({ success: false, error: "Job not found." });
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(unchanged.status).toBe("closed");
  });
});

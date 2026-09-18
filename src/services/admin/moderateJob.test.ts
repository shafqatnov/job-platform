import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { approveJob, rejectJob } from "@/services/admin/moderateJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

/**
 * Real dev-database test (same pattern as the AI moderation suite) for
 * the public-cache-revalidation fix: approving a job must invalidate
 * the static /jobs and / pages so it doesn't stay invisible until the
 * next deployment; rejecting one must not.
 */
describe("moderateJob revalidation (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let adminUserId: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const admin = await prisma.user.create({
      data: {
        email: `moderate-job-test-admin-${crypto.randomUUID()}@example.invalid`,
        name: "[AI MODERATION TEST] Admin",
        role: "admin",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    adminUserId = admin.id;
  });

  afterEach(() => {
    revalidatePathMock.mockClear();
  });

  afterAll(async () => {
    await prisma.moderationAction.deleteMany({ where: { adminUserId } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
    await cleanupModerationTestFixtures(fixtures);
  });

  it("approveJob updates the job to active and revalidates /jobs and /", async () => {
    const job = await createTestJob(fixtures, { status: "pending_review" });

    const result = await approveJob(adminUserId, job.id);

    expect(result).toEqual({ success: true });

    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
      select: { status: true, postedAt: true, expiresAt: true, deletedAt: true },
    });
    expect(updated.status).toBe("active");
    expect(updated.postedAt).not.toBeNull();
    expect(updated.expiresAt).not.toBeNull();
    expect(updated.deletedAt).toBeNull();

    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });

  it("approveJob does NOT revalidate when the job is no longer pending review", async () => {
    const job = await createTestJob(fixtures, { status: "active" });

    const result = await approveJob(adminUserId, job.id);

    expect(result).toEqual({ success: false, error: "This job is no longer pending review." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejectJob updates the job to rejected and does NOT revalidate any public path", async () => {
    const job = await createTestJob(fixtures, { status: "pending_review" });

    const result = await rejectJob(adminUserId, job.id, "Not a real job posting.");

    expect(result).toEqual({ success: true });

    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
      select: { status: true },
    });
    expect(updated.status).toBe("rejected");

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

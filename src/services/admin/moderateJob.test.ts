import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { approveJob, rejectJob, closeJobAsAdmin, reopenJobAsAdmin, deleteJobAsAdmin } from "@/services/admin/moderateJob";
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

describe("admin job lifecycle (close/reopen/delete) (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let adminUserId: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const admin = await prisma.user.create({
      data: {
        email: `moderate-job-lifecycle-test-admin-${crypto.randomUUID()}@example.invalid`,
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

  it("authorized admin can close any active job and logs a ModerationAction", async () => {
    const job = await createTestJob(fixtures, { status: "active" });

    const result = await closeJobAsAdmin(adminUserId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(updated.status).toBe("closed");

    const action = await prisma.moderationAction.findFirst({ where: { adminUserId, targetJobId: job.id, action: "close" } });
    expect(action).not.toBeNull();
  });

  it("authorized admin can reopen a closed job that has not expired, and logs a ModerationAction", async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const job = await createTestJob(fixtures, { status: "closed", expiresAt: future });

    const result = await reopenJobAsAdmin(adminUserId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
    expect(updated.status).toBe("active");

    const action = await prisma.moderationAction.findFirst({ where: { adminUserId, targetJobId: job.id, action: "reopen" } });
    expect(action).not.toBeNull();
  });

  it("admin cannot reopen an already-expired job", async () => {
    const job = await createTestJob(fixtures, { status: "expired" });
    const result = await reopenJobAsAdmin(adminUserId, job.id);
    expect(result).toEqual({ success: false, error: "This job cannot be reopened from its current state." });
  });

  it("admin can delete a job that is safe to delete (no applications or saved-job bookmarks), and logs a ModerationAction", async () => {
    const job = await createTestJob(fixtures, { status: "pending_review" });

    const result = await deleteJobAsAdmin(adminUserId, job.id);

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { deletedAt: true } });
    expect(updated.deletedAt).not.toBeNull();

    const action = await prisma.moderationAction.findFirst({ where: { adminUserId, targetJobId: job.id, action: "delete" } });
    expect(action).not.toBeNull();
  });

  it("admin cannot delete a job with an application — reports the exact reason and does not delete", async () => {
    const candidate = await createCandidateTestFixtures();
    try {
      const job = await createTestJob(fixtures, { status: "active", applicationMethod: "on_platform" });
      const applyResult = await applyToJob({ userId: candidate.userId, jobId: job.id });
      expect(applyResult.success).toBe(true);

      const result = await deleteJobAsAdmin(adminUserId, job.id);

      expect(result).toEqual({
        success: false,
        error: "This job cannot be permanently deleted because it has associated application data. You can close the job instead.",
      });
      const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { deletedAt: true } });
      expect(unchanged.deletedAt).toBeNull();
    } finally {
      await cleanupCandidateTestFixtures(candidate);
    }
  });
});

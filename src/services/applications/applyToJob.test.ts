import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applyToJob } from "@/services/applications/applyToJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/**
 * Real dev-database test (same pattern as the AI moderation suite):
 * every fixture is freshly created with an `@example.invalid` email and
 * a "[APPLY TEST]"-labeled job/company, and everything created here is
 * deleted in afterAll — the real employer/candidate/job data in this
 * environment is never touched.
 */
describe("applyToJob duplicate prevention (real dev database, temporary fixtures)", () => {
  let employerFixtures: ModerationTestFixtures;
  let candidateUserId: string;
  let candidateProfileId: string;
  let jobId: string;

  beforeAll(async () => {
    employerFixtures = await createModerationTestFixtures();
    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    jobId = job.id;

    const candidateUser = await prisma.user.create({
      data: {
        email: `apply-test-${crypto.randomUUID()}@example.invalid`,
        name: "[APPLY TEST] Candidate",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    candidateUserId = candidateUser.id;

    const candidateProfile = await prisma.candidateProfile.create({
      data: {
        userId: candidateUserId,
        countryId: employerFixtures.countryId,
        cityId: employerFixtures.cityId,
        fullName: "Apply Test Candidate",
      },
      select: { id: true },
    });
    candidateProfileId = candidateProfile.id;
  });

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { candidateProfileId } });
    await prisma.candidateProfile.deleteMany({ where: { userId: candidateUserId } });
    await prisma.user.deleteMany({ where: { id: candidateUserId } });
    await cleanupModerationTestFixtures(employerFixtures);
  });

  it("creates an application for a candidate applying to an active on-platform job", async () => {
    const result = await applyToJob({ userId: candidateUserId, jobId });
    expect(result.success).toBe(true);
  });

  it("rejects a second application to the same job from the same candidate", async () => {
    const result = await applyToJob({ userId: candidateUserId, jobId });
    expect(result).toEqual({ success: false, error: "You have already applied to this job." });
  });

  it("rejects application from a user with no candidate profile", async () => {
    const otherUser = await prisma.user.create({
      data: {
        email: `apply-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[APPLY TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const result = await applyToJob({ userId: otherUser.id, jobId });
      expect(result.success).toBe(false);
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUser.id } });
    }
  });

  it("stores no cover note (null) when none is provided — matches this suite's very first application above", async () => {
    const application = await prisma.application.findFirstOrThrow({
      where: { candidateProfileId, jobId },
      select: { coverNote: true },
    });
    expect(application.coverNote).toBeNull();
  });

  it("accepts an optional cover note and stores it, trimmed, through the existing application creation path", async () => {
    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Cover Note Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });

    const result = await applyToJob({
      userId: candidateUserId,
      jobId: job.id,
      coverNote: "  I'm very interested in this role.  ",
    });

    expect(result.success).toBe(true);
    const application = await prisma.application.findFirstOrThrow({
      where: { candidateProfileId, jobId: job.id },
      select: { coverNote: true },
    });
    expect(application.coverNote).toBe("I'm very interested in this role.");
  });

  it("rejects a cover note over the maximum length and creates no application row", async () => {
    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Cover Note Too Long Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });

    const result = await applyToJob({
      userId: candidateUserId,
      jobId: job.id,
      coverNote: "x".repeat(2001),
    });

    expect(result).toEqual({ success: false, error: "Cover note must be 2000 characters or fewer." });
    const application = await prisma.application.findFirst({
      where: { candidateProfileId, jobId: job.id },
      select: { id: true },
    });
    expect(application).toBeNull();
  });

  it("accepts a cover note at exactly the maximum length", async () => {
    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Cover Note Max Length Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });

    const result = await applyToJob({
      userId: candidateUserId,
      jobId: job.id,
      coverNote: "x".repeat(2000),
    });

    expect(result.success).toBe(true);
    const application = await prisma.application.findFirstOrThrow({
      where: { candidateProfileId, jobId: job.id },
      select: { coverNote: true },
    });
    expect(application.coverNote).toHaveLength(2000);
  });

  it("treats a whitespace-only cover note the same as no cover note — stored as null", async () => {
    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Cover Note Blank Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });

    const result = await applyToJob({ userId: candidateUserId, jobId: job.id, coverNote: "   " });

    expect(result.success).toBe(true);
    const application = await prisma.application.findFirstOrThrow({
      where: { candidateProfileId, jobId: job.id },
      select: { coverNote: true },
    });
    expect(application.coverNote).toBeNull();
  });

  it("authorization: the created application always belongs to the caller's own candidate profile, derived from userId — a client-supplied candidateProfileId cannot redirect ownership", async () => {
    const otherCandidateUser = await prisma.user.create({
      data: {
        email: `apply-test-other-${crypto.randomUUID()}@example.invalid`,
        name: "[APPLY TEST] Other Candidate",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    const otherCandidateProfile = await prisma.candidateProfile.create({
      data: {
        userId: otherCandidateUser.id,
        countryId: employerFixtures.countryId,
        cityId: employerFixtures.cityId,
        fullName: "Other Apply Test Candidate",
      },
      select: { id: true },
    });

    const job = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Ownership Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });

    try {
      // applyToJob's input has no candidateProfileId field — the type
      // system already rejects one — but this simulates a hostile
      // caller smuggling one in anyway. The service only ever derives
      // ownership from input.userId via getCandidateProfile, so the
      // resulting application must belong to otherCandidateUser's own
      // profile, never candidateProfileId (fixture A's profile).
      const maliciousInput = {
        userId: otherCandidateUser.id,
        candidateProfileId,
        jobId: job.id,
      } as unknown as Parameters<typeof applyToJob>[0];

      const result = await applyToJob(maliciousInput);
      expect(result.success).toBe(true);

      const application = await prisma.application.findFirstOrThrow({
        where: { jobId: job.id },
        select: { candidateProfileId: true },
      });
      expect(application.candidateProfileId).toBe(otherCandidateProfile.id);
      expect(application.candidateProfileId).not.toBe(candidateProfileId);
    } finally {
      await prisma.application.deleteMany({ where: { candidateProfileId: otherCandidateProfile.id } });
      await prisma.candidateProfile.deleteMany({ where: { userId: otherCandidateUser.id } });
      await prisma.user.deleteMany({ where: { id: otherCandidateUser.id } });
    }
  });

  it("job eligibility checks remain unchanged: pending, expired, soft-deleted, and external-application-method jobs all reject applications", async () => {
    const pendingJob = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Pending Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "pending_review",
    });
    const expiredJob = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Expired Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const deletedJob = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] Deleted Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
      deletedAt: new Date(),
    });
    const externalJob = await createTestJob(employerFixtures, {
      title: `[APPLY TEST] External Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "external_url",
      externalApplicationUrl: "https://example.invalid/apply",
    });

    const expectedError = { success: false, error: "This job is no longer accepting applications." };
    expect(await applyToJob({ userId: candidateUserId, jobId: pendingJob.id })).toEqual(expectedError);
    expect(await applyToJob({ userId: candidateUserId, jobId: expiredJob.id })).toEqual(expectedError);
    expect(await applyToJob({ userId: candidateUserId, jobId: deletedJob.id })).toEqual(expectedError);
    expect(await applyToJob({ userId: candidateUserId, jobId: externalJob.id })).toEqual(expectedError);

    const applicationCount = await prisma.application.count({
      where: { jobId: { in: [pendingJob.id, expiredJob.id, deletedJob.id, externalJob.id] } },
    });
    expect(applicationCount).toBe(0);
  });
});

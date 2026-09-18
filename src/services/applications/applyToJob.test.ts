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
});

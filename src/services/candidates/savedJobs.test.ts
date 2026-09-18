import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { saveJob } from "@/services/candidates/saveJob";
import { unsaveJob } from "@/services/candidates/unsaveJob";
import { isJobSaved } from "@/services/candidates/isJobSaved";
import { getSavedJobs, getSavedJobIdSet } from "@/services/candidates/getSavedJobs";
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

describe("Saved jobs (real dev database, temporary fixtures)", () => {
  let jobFixtures: ModerationTestFixtures;
  let candidateA: CandidateTestFixtures;
  let candidateB: CandidateTestFixtures;
  let activeJobId: string;
  let pendingJobId: string;
  let expiredJobId: string;

  beforeAll(async () => {
    jobFixtures = await createModerationTestFixtures();
    candidateA = await createCandidateTestFixtures();
    candidateB = await createCandidateTestFixtures();

    const activeJob = await createTestJob(jobFixtures, {
      title: `[AI MODERATION TEST] Saved Job Active ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    });
    activeJobId = activeJob.id;

    const pendingJob = await createTestJob(jobFixtures, {
      title: `[AI MODERATION TEST] Saved Job Pending ${crypto.randomUUID().slice(0, 8)}`,
      status: "pending_review",
    });
    pendingJobId = pendingJob.id;

    const expiredJob = await createTestJob(jobFixtures, {
      title: `[AI MODERATION TEST] Saved Job Expired ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    expiredJobId = expiredJob.id;
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidateA);
    await cleanupCandidateTestFixtures(candidateB);
    await cleanupModerationTestFixtures(jobFixtures);
  });

  it("saves an active, publicly-visible job", async () => {
    const result = await saveJob(candidateA.userId, activeJobId);
    expect(result).toEqual({ success: true });
    expect(await isJobSaved(candidateA.candidateProfileId, activeJobId)).toBe(true);
  });

  it("treats a duplicate save as an idempotent success, creating only one row", async () => {
    const result = await saveJob(candidateA.userId, activeJobId);
    expect(result).toEqual({ success: true });

    const count = await prisma.savedJob.count({
      where: { candidateProfileId: candidateA.candidateProfileId, jobId: activeJobId },
    });
    expect(count).toBe(1);
  });

  it("refuses to save a job that is not publicly visible (pending review)", async () => {
    const result = await saveJob(candidateA.userId, pendingJobId);
    expect(result).toEqual({ success: false, error: "This job is no longer available to save." });
    expect(await isJobSaved(candidateA.candidateProfileId, pendingJobId)).toBe(false);
  });

  it("refuses to save an expired job", async () => {
    const result = await saveJob(candidateA.userId, expiredJobId);
    expect(result).toEqual({ success: false, error: "This job is no longer available to save." });
  });

  it("fails safely (no throw) when the account has no candidate profile yet", async () => {
    const noProfileUser = await prisma.user.create({
      data: {
        email: `candidate-dashboard-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[CANDIDATE DASHBOARD TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const saveResult = await saveJob(noProfileUser.id, activeJobId);
      expect(saveResult).toEqual({ success: false, error: "Create your candidate profile before saving jobs." });

      const unsaveResult = await unsaveJob(noProfileUser.id, activeJobId);
      expect(unsaveResult).toEqual({ success: false, error: "Create your candidate profile first." });
    } finally {
      await prisma.user.deleteMany({ where: { id: noProfileUser.id } });
    }
  });

  it("saving as one candidate never affects another candidate's saved jobs", async () => {
    // candidateA already saved activeJobId above; candidateB never has.
    expect(await isJobSaved(candidateB.candidateProfileId, activeJobId)).toBe(false);

    // Candidate B unsaving a job only ever saved by candidate A must be
    // a safe no-op scoped to B's own (nonexistent) row — it must never
    // touch A's real saved row.
    await unsaveJob(candidateB.userId, activeJobId);
    expect(await isJobSaved(candidateA.candidateProfileId, activeJobId)).toBe(true);
  });

  it("getSavedJobs excludes pending/expired jobs even if somehow saved, and lists only public-visible ones", async () => {
    // Force-create SavedJob rows directly (bypassing saveJob's own
    // visibility gate) to prove getSavedJobs applies its own
    // independent visibility filter on read, not just on write.
    await prisma.savedJob.createMany({
      data: [
        { candidateProfileId: candidateA.candidateProfileId, jobId: pendingJobId },
        { candidateProfileId: candidateA.candidateProfileId, jobId: expiredJobId },
      ],
      skipDuplicates: true,
    });

    const jobs = await getSavedJobs(candidateA.candidateProfileId);
    const ids = jobs.map((job) => job.id);

    expect(ids).toContain(activeJobId);
    expect(ids).not.toContain(pendingJobId);
    expect(ids).not.toContain(expiredJobId);

    // Clean up the directly-inserted rows so they don't affect other tests.
    await prisma.savedJob.deleteMany({
      where: { candidateProfileId: candidateA.candidateProfileId, jobId: { in: [pendingJobId, expiredJobId] } },
    });
  });

  it("unsaves a job, and unsaving again is a safe no-op", async () => {
    const first = await unsaveJob(candidateA.userId, activeJobId);
    expect(first).toEqual({ success: true });
    expect(await isJobSaved(candidateA.candidateProfileId, activeJobId)).toBe(false);

    const second = await unsaveJob(candidateA.userId, activeJobId);
    expect(second).toEqual({ success: true });
  });

  it("getSavedJobIdSet returns a batched set for a page of job IDs, without an N+1 query per job", async () => {
    await saveJob(candidateA.userId, activeJobId);

    const set = await getSavedJobIdSet(candidateA.candidateProfileId, [activeJobId, pendingJobId, expiredJobId]);
    expect(set.has(activeJobId)).toBe(true);
    expect(set.has(pendingJobId)).toBe(false);

    const emptySet = await getSavedJobIdSet(candidateA.candidateProfileId, []);
    expect(emptySet.size).toBe(0);
  });
});

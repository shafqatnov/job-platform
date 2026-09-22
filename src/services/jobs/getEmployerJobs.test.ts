import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getEmployerJobs } from "@/services/jobs/getEmployerJobs";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";
import { createCandidateTestFixtures, cleanupCandidateTestFixtures } from "@/test-utils/candidateFixtures";

describe("getEmployerJobs (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("returns jobs of every status when no status filter is given (existing dashboard behavior, unchanged)", async () => {
    const active = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Active", status: "active" });
    const pending = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Pending", status: "pending_review" });
    try {
      const jobs = await getEmployerJobs(fixtures.companyId);
      const ids = jobs.map((j) => j.id);
      expect(ids).toContain(active.id);
      expect(ids).toContain(pending.id);
    } finally {
      await prisma.job.deleteMany({ where: { id: { in: [active.id, pending.id] } } });
    }
  });

  it("narrows to a single status when one is given", async () => {
    const active = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Active Only", status: "active" });
    const pending = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Pending Only", status: "pending_review" });
    try {
      const activeJobs = await getEmployerJobs(fixtures.companyId, "active");
      const activeIds = activeJobs.map((j) => j.id);
      expect(activeIds).toContain(active.id);
      expect(activeIds).not.toContain(pending.id);

      const pendingJobs = await getEmployerJobs(fixtures.companyId, "pending_review");
      const pendingIds = pendingJobs.map((j) => j.id);
      expect(pendingIds).toContain(pending.id);
      expect(pendingIds).not.toContain(active.id);
    } finally {
      await prisma.job.deleteMany({ where: { id: { in: [active.id, pending.id] } } });
    }
  });

  it("narrows to any of several statuses when an array is given", async () => {
    const active = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Array Active", status: "active" });
    const pending = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Array Pending", status: "pending_review" });
    const rejected = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Array Rejected", status: "rejected" });
    try {
      const jobs = await getEmployerJobs(fixtures.companyId, ["active", "pending_review"]);
      const ids = jobs.map((j) => j.id);
      expect(ids).toContain(active.id);
      expect(ids).toContain(pending.id);
      expect(ids).not.toContain(rejected.id);
    } finally {
      await prisma.job.deleteMany({ where: { id: { in: [active.id, pending.id, rejected.id] } } });
    }
  });

  it("reports a real savedJobCount, reflecting actual SavedJob rows", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Saved Count", status: "active" });
    const candidate = await createCandidateTestFixtures();
    try {
      const before = await getEmployerJobs(fixtures.companyId, "active");
      const beforeCount = before.find((j) => j.id === job.id)?.savedJobCount ?? 0;

      await prisma.savedJob.create({ data: { candidateProfileId: candidate.candidateProfileId, jobId: job.id } });

      const after = await getEmployerJobs(fixtures.companyId, "active");
      const afterCount = after.find((j) => j.id === job.id)?.savedJobCount ?? 0;
      expect(afterCount).toBe(beforeCount + 1);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("authorization: never returns another company's jobs", async () => {
    const otherCompany = await createModerationTestFixtures();
    try {
      const ownJob = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Employer Jobs Own Company", status: "active" });
      const otherJob = await createTestJob(otherCompany, { title: "[AI MODERATION TEST] Employer Jobs Other Company", status: "active" });
      try {
        const jobs = await getEmployerJobs(fixtures.companyId);
        const ids = jobs.map((j) => j.id);
        expect(ids).toContain(ownJob.id);
        expect(ids).not.toContain(otherJob.id);
      } finally {
        await prisma.job.deleteMany({ where: { id: { in: [ownJob.id, otherJob.id] } } });
      }
    } finally {
      await cleanupModerationTestFixtures(otherCompany);
    }
  });
});

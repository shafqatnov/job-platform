import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { applyToJob } from "@/services/applications/applyToJob";
import { getApplicationsForCandidate } from "@/services/applications/getApplicationsForCandidate";
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

describe("getApplicationsForCandidate (real dev database, temporary fixtures)", () => {
  let jobFixtures: ModerationTestFixtures;
  let candidateA: CandidateTestFixtures;
  let candidateB: CandidateTestFixtures;
  let jobId: string;

  beforeAll(async () => {
    jobFixtures = await createModerationTestFixtures();
    candidateA = await createCandidateTestFixtures();
    candidateB = await createCandidateTestFixtures();

    const job = await createTestJob(jobFixtures, {
      title: `[AI MODERATION TEST] Candidate Applications Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    jobId = job.id;

    const result = await applyToJob({ userId: candidateA.userId, jobId, coverNote: "Hello!" });
    if (!result.success) {
      throw new Error(`Test setup failed: ${result.error}`);
    }
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidateA);
    await cleanupCandidateTestFixtures(candidateB);
    await cleanupModerationTestFixtures(jobFixtures);
  });

  it("returns the candidate's own application with the expected fields", async () => {
    const applications = await getApplicationsForCandidate(candidateA.candidateProfileId);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      jobTitle: expect.stringContaining("Candidate Applications Job"),
      companyName: expect.any(String),
      status: "received",
    });
  });

  it("never returns another candidate's applications", async () => {
    const applicationsForB = await getApplicationsForCandidate(candidateB.candidateProfileId);
    expect(applicationsForB).toEqual([]);
  });

  it("returns an empty list (not an error) for a candidate with no applications yet", async () => {
    const applications = await getApplicationsForCandidate(candidateB.candidateProfileId);
    expect(applications).toEqual([]);
  });
});

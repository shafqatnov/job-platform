import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyToJob } from "@/services/applications/applyToJob";
import { getApplicationsForCompany } from "@/services/applications/getApplicationsForCompany";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";
import { createCandidateTestFixtures, cleanupCandidateTestFixtures, type CandidateTestFixtures } from "@/test-utils/candidateFixtures";

describe("getApplicationsForCompany (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let candidate: CandidateTestFixtures;
  let jobOneId: string;
  let jobOneTitle: string;
  let jobTwoId: string;
  let jobTwoTitle: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    candidate = await createCandidateTestFixtures();

    const jobOne = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Company Applications Job One",
      status: "active",
      applicationMethod: "on_platform",
    });
    const jobTwo = await createTestJob(fixtures, {
      title: "[AI MODERATION TEST] Company Applications Job Two",
      status: "active",
      applicationMethod: "on_platform",
    });
    jobOneId = jobOne.id;
    jobOneTitle = jobOne.title;
    jobTwoId = jobTwo.id;
    jobTwoTitle = jobTwo.title;

    const resultOne = await applyToJob({ userId: candidate.userId, jobId: jobOneId });
    if (!resultOne.success) throw new Error(`Test setup failed: ${resultOne.error}`);
    const resultTwo = await applyToJob({ userId: candidate.userId, jobId: jobTwoId });
    if (!resultTwo.success) throw new Error(`Test setup failed: ${resultTwo.error}`);
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidate);
    await cleanupModerationTestFixtures(fixtures);
  });

  it("returns applications spanning every job that belongs to the company, not just one", async () => {
    const applications = await getApplicationsForCompany(fixtures.companyId);
    const jobIds = applications.map((a) => a.jobId);
    expect(jobIds).toContain(jobOneId);
    expect(jobIds).toContain(jobTwoId);
  });

  it("includes the correct job title for each application, so a multi-job list stays unambiguous", async () => {
    const applications = await getApplicationsForCompany(fixtures.companyId);
    const forJobOne = applications.find((a) => a.jobId === jobOneId);
    const forJobTwo = applications.find((a) => a.jobId === jobTwoId);
    expect(forJobOne?.jobTitle).toBe(jobOneTitle);
    expect(forJobTwo?.jobTitle).toBe(jobTwoTitle);
  });

  it("authorization: never returns another company's applications", async () => {
    const otherCompany = await createModerationTestFixtures();
    const otherCandidate = await createCandidateTestFixtures();
    try {
      const otherJob = await createTestJob(otherCompany, {
        title: "[AI MODERATION TEST] Other Company Application Job",
        status: "active",
        applicationMethod: "on_platform",
      });
      const result = await applyToJob({ userId: otherCandidate.userId, jobId: otherJob.id });
      if (!result.success) throw new Error(`Test setup failed: ${result.error}`);

      const applications = await getApplicationsForCompany(fixtures.companyId);
      expect(applications.some((a) => a.jobId === otherJob.id)).toBe(false);

      const otherApplications = await getApplicationsForCompany(otherCompany.companyId);
      expect(otherApplications.some((a) => a.jobId === otherJob.id)).toBe(true);
      expect(otherApplications.some((a) => a.jobId === jobOneId)).toBe(false);
    } finally {
      await cleanupCandidateTestFixtures(otherCandidate);
      await cleanupModerationTestFixtures(otherCompany);
    }
  });

  it("never exposes the candidate's resume URL or email — same privacy boundary as the per-job applications read", async () => {
    const applications = await getApplicationsForCompany(fixtures.companyId);
    applications.forEach((application) => {
      expect(application).not.toHaveProperty("resumeFileUrl");
      expect(application).not.toHaveProperty("candidateEmail");
      expect(application).not.toHaveProperty("email");
    });
  });
});

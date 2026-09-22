import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRecommendedJobsForCandidate } from "@/services/candidates/getRecommendedJobs";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
} from "@/test-utils/moderationFixtures";
import { createCandidateTestFixtures, cleanupCandidateTestFixtures } from "@/test-utils/candidateFixtures";

describe("getRecommendedJobsForCandidate (real dev database, temporary fixtures)", () => {
  it("recommends a real active public job in the candidate's own country", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidate = await createCandidateTestFixtures();
    try {
      const country = await prisma.country.findUniqueOrThrow({ where: { id: jobFixtures.countryId }, select: { urlSlug: true } });
      const job = await createTestJob(jobFixtures, { title: "[AI MODERATION TEST] Recommended Job Fixture", status: "active" });

      const recommendations = await getRecommendedJobsForCandidate(candidate.candidateProfileId, country.urlSlug);
      expect(recommendations.some((j) => j.id === job.id)).toBe(true);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });

  it("never recommends a job the candidate has already saved", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidate = await createCandidateTestFixtures();
    try {
      const country = await prisma.country.findUniqueOrThrow({ where: { id: jobFixtures.countryId }, select: { urlSlug: true } });
      const job = await createTestJob(jobFixtures, { title: "[AI MODERATION TEST] Already Saved Job", status: "active" });
      await prisma.savedJob.create({ data: { candidateProfileId: candidate.candidateProfileId, jobId: job.id } });

      const recommendations = await getRecommendedJobsForCandidate(candidate.candidateProfileId, country.urlSlug);
      expect(recommendations.some((j) => j.id === job.id)).toBe(false);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });

  it("never recommends a job the candidate has already applied to", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidate = await createCandidateTestFixtures();
    try {
      const country = await prisma.country.findUniqueOrThrow({ where: { id: jobFixtures.countryId }, select: { urlSlug: true } });
      const job = await createTestJob(jobFixtures, {
        title: "[AI MODERATION TEST] Already Applied Job",
        status: "active",
        applicationMethod: "on_platform",
      });
      await prisma.application.create({ data: { candidateProfileId: candidate.candidateProfileId, jobId: job.id } });

      const recommendations = await getRecommendedJobsForCandidate(candidate.candidateProfileId, country.urlSlug);
      expect(recommendations.some((j) => j.id === job.id)).toBe(false);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });

  it("never recommends a job in a different country", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidate = await createCandidateTestFixtures();
    try {
      const otherCountry = await prisma.country.findFirstOrThrow({
        where: { id: { not: jobFixtures.countryId } },
        select: { urlSlug: true },
      });
      const job = await createTestJob(jobFixtures, { title: "[AI MODERATION TEST] Same Country Job", status: "active" });

      const recommendations = await getRecommendedJobsForCandidate(candidate.candidateProfileId, otherCountry.urlSlug);
      expect(recommendations.some((j) => j.id === job.id)).toBe(false);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });

  it("never recommends an expired or test-fixture-marker job (uses the same public visibility rule)", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidate = await createCandidateTestFixtures();
    try {
      const country = await prisma.country.findUniqueOrThrow({ where: { id: jobFixtures.countryId }, select: { urlSlug: true } });
      const expiredJob = await createTestJob(jobFixtures, {
        title: "[AI MODERATION TEST] Expired Recommendation Fixture",
        status: "active",
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      });
      const fixtureMarkerJob = await createTestJob(jobFixtures, {
        title: "[IMPORT TEST] Should Not Recommend",
        status: "active",
      });

      const recommendations = await getRecommendedJobsForCandidate(candidate.candidateProfileId, country.urlSlug);
      expect(recommendations.some((j) => j.id === expiredJob.id)).toBe(false);
      expect(recommendations.some((j) => j.id === fixtureMarkerJob.id)).toBe(false);
    } finally {
      await cleanupCandidateTestFixtures(candidate);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });

  it("authorization: one candidate's saved/applied exclusions never affect another candidate's recommendations", async () => {
    const jobFixtures = await createModerationTestFixtures();
    const candidateA = await createCandidateTestFixtures();
    const candidateB = await createCandidateTestFixtures();
    try {
      const country = await prisma.country.findUniqueOrThrow({ where: { id: jobFixtures.countryId }, select: { urlSlug: true } });
      const job = await createTestJob(jobFixtures, { title: "[AI MODERATION TEST] Cross-Candidate Isolation Fixture", status: "active" });
      await prisma.savedJob.create({ data: { candidateProfileId: candidateA.candidateProfileId, jobId: job.id } });

      const recommendationsForA = await getRecommendedJobsForCandidate(candidateA.candidateProfileId, country.urlSlug);
      const recommendationsForB = await getRecommendedJobsForCandidate(candidateB.candidateProfileId, country.urlSlug);

      expect(recommendationsForA.some((j) => j.id === job.id)).toBe(false);
      expect(recommendationsForB.some((j) => j.id === job.id)).toBe(true);
    } finally {
      await cleanupCandidateTestFixtures(candidateA);
      await cleanupCandidateTestFixtures(candidateB);
      await cleanupModerationTestFixtures(jobFixtures);
    }
  });
});

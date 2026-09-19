import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applyToJob } from "@/services/applications/applyToJob";
import { getApplicationsForJob } from "@/services/applications/getApplicationsForJob";
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

describe("getApplicationsForJob (real dev database, temporary fixtures)", () => {
  let employerA: ModerationTestFixtures;
  let employerB: ModerationTestFixtures;
  let candidateWithDetails: CandidateTestFixtures;
  let candidateMinimal: CandidateTestFixtures;
  let countryName: string;
  let cityName: string;

  beforeAll(async () => {
    employerA = await createModerationTestFixtures();
    employerB = await createModerationTestFixtures();
    candidateWithDetails = await createCandidateTestFixtures();
    candidateMinimal = await createCandidateTestFixtures();

    const [country, city] = await Promise.all([
      prisma.country.findUniqueOrThrow({ where: { id: candidateWithDetails.countryId }, select: { name: true } }),
      prisma.city.findUniqueOrThrow({ where: { id: candidateWithDetails.cityId }, select: { name: true } }),
    ]);
    countryName = country.name;
    cityName = city.name;

    // Give candidateWithDetails a headline (candidateFixtures.ts leaves it
    // null by default) and clear candidateMinimal's city, so both the
    // "present" and "absent/null" cases are exercised against real rows,
    // not assumed.
    await prisma.candidateProfile.update({
      where: { id: candidateWithDetails.candidateProfileId },
      data: { headline: "[CANDIDATE DASHBOARD TEST] Senior Test Engineer" },
    });
    await prisma.candidateProfile.update({
      where: { id: candidateMinimal.candidateProfileId },
      data: { headline: null, cityId: null },
    });
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidateWithDetails);
    await cleanupCandidateTestFixtures(candidateMinimal);
    await cleanupModerationTestFixtures(employerA);
    await cleanupModerationTestFixtures(employerB);
  });

  it("returns candidate headline, country, city, and cover note when present", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Enriched Applications Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({
      userId: candidateWithDetails.userId,
      jobId: job.id,
      coverNote: "I would love to work on this role.",
    });
    expect(applyResult.success).toBe(true);

    const applications = await getApplicationsForJob(job.id);

    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      candidateName: "[CANDIDATE DASHBOARD TEST] Full Name",
      candidateHeadline: "[CANDIDATE DASHBOARD TEST] Senior Test Engineer",
      candidateCountryName: countryName,
      candidateCityName: cityName,
      coverNote: "I would love to work on this role.",
      status: "received",
    });
  });

  it("handles a null headline, null city, and null cover note gracefully", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Minimal Applications Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);

    const applications = await getApplicationsForJob(job.id);

    expect(applications).toHaveLength(1);
    expect(applications[0].candidateHeadline).toBeNull();
    expect(applications[0].candidateCityName).toBeNull();
    expect(applications[0].coverNote).toBeNull();
    // Country is required on CandidateProfile — never null, unlike city.
    expect(applications[0].candidateCountryName).toBe(countryName);
  });

  it("returns the correct application date and existing status unchanged", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Date Status Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const beforeApply = new Date();
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);

    const applications = await getApplicationsForJob(job.id);

    expect(applications).toHaveLength(1);
    expect(applications[0].status).toBe("received");
    const appliedDate = new Date(applications[0].appliedDate);
    expect(appliedDate.getTime()).not.toBeNaN();
    expect(appliedDate.getTime()).toBeGreaterThanOrEqual(beforeApply.getTime());
  });

  it("never exposes resumeFileUrl or candidate email — only the documented fields are returned", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] No Leak Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });

    const applications = await getApplicationsForJob(job.id);

    expect(applications).toHaveLength(1);
    const returnedKeys = Object.keys(applications[0]).sort();
    expect(returnedKeys).toEqual(
      [
        "appliedDate",
        "candidateCityName",
        "candidateCountryName",
        "candidateHeadline",
        "candidateName",
        "coverNote",
        "id",
        "status",
      ].sort()
    );
  });

  it("employer A cannot retrieve applications for employer B's job by calling with employer B's own job id — ownership stays the caller's responsibility, verified via getEmployerJobDetail", async () => {
    const jobB = await createTestJob(employerB, {
      title: `[AI MODERATION TEST] Employer B Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    await applyToJob({ userId: candidateMinimal.userId, jobId: jobB.id });

    const { getEmployerJobDetail } = await import("@/services/jobs/getEmployerJobDetail");
    // The real ownership boundary: employer A's own companyId never
    // resolves employer B's job, so the applications page never reaches
    // getApplicationsForJob for it at all.
    const asSeenByEmployerA = await getEmployerJobDetail(jobB.id, employerA.companyId);
    expect(asSeenByEmployerA).toBeNull();

    // getApplicationsForJob itself is scoped by jobId only (ownership is
    // enforced one layer up, exactly like getApplicationsForCandidate) —
    // this documents that trust boundary rather than re-implementing it.
    const applicationsForJobB = await getApplicationsForJob(jobB.id);
    expect(applicationsForJobB).toHaveLength(1);
    expect(applicationsForJobB[0].candidateName).toBe("[CANDIDATE DASHBOARD TEST] Full Name");
  });

  it("returns an empty list (not an error) for a job with no applications", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] No Applications Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    });
    const applications = await getApplicationsForJob(job.id);
    expect(applications).toEqual([]);
  });
});

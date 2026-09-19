import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { applyToJob } from "@/services/applications/applyToJob";
import { getApplicationForEmployer } from "@/services/applications/getApplicationForEmployer";
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

describe("getApplicationForEmployer (real dev database, temporary fixtures)", () => {
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

  it("1. employer can retrieve an application belonging to their own job", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({
      userId: candidateWithDetails.userId,
      jobId: job.id,
      coverNote: "I'm excited about this role.",
    });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    const detail = await getApplicationForEmployer(applyResult.applicationId, job.id);

    expect(detail).toMatchObject({
      id: applyResult.applicationId,
      candidateName: "[CANDIDATE DASHBOARD TEST] Full Name",
      candidateHeadline: "[CANDIDATE DASHBOARD TEST] Senior Test Engineer",
      candidateCountryName: countryName,
      candidateCityName: cityName,
      coverNote: "I'm excited about this role.",
      status: "received",
    });
  });

  it("2. employer cannot retrieve an application belonging to another employer's job (mismatched jobId)", async () => {
    const jobB = await createTestJob(employerB, {
      title: `[AI MODERATION TEST] Employer B Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: jobB.id });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    // Simulates employer A's own job being passed alongside employer B's
    // real applicationId — the exact "substitute a foreign job" attack
    // this function's jobId scoping must reject.
    const jobA = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Employer A Unrelated Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    });

    const detail = await getApplicationForEmployer(applyResult.applicationId, jobA.id);
    expect(detail).toBeNull();
  });

  it("3. employer cannot use an application ID from another job belonging to the SAME company with a different jobId", async () => {
    const jobOne = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Same Company Job One ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const jobTwo = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Same Company Job Two ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    });
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: jobOne.id });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    // Real application, real same-company ownership, but the WRONG job id.
    const detail = await getApplicationForEmployer(applyResult.applicationId, jobTwo.id);
    expect(detail).toBeNull();

    // Sanity: the correct pairing still works.
    const correctDetail = await getApplicationForEmployer(applyResult.applicationId, jobOne.id);
    expect(correctDetail).not.toBeNull();
  });

  it("4. a nonexistent application id returns null", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] No Application Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    });
    const detail = await getApplicationForEmployer(crypto.randomUUID(), job.id);
    expect(detail).toBeNull();
  });

  it("5, 7. handles a null headline, null city, and null cover note gracefully", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Minimal Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    const detail = await getApplicationForEmployer(applyResult.applicationId, job.id);

    expect(detail).not.toBeNull();
    expect(detail?.candidateHeadline).toBeNull();
    expect(detail?.candidateCityName).toBeNull();
    expect(detail?.coverNote).toBeNull();
    // Country is required on CandidateProfile — never null, unlike city.
    expect(detail?.candidateCountryName).toBe(countryName);
  });

  it("6. returns the cover note verbatim when present", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Cover Note Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({
      userId: candidateWithDetails.userId,
      jobId: job.id,
      coverNote: "Please consider my application for this position.",
    });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    const detail = await getApplicationForEmployer(applyResult.applicationId, job.id);
    expect(detail?.coverNote).toBe("Please consider my application for this position.");
  });

  it("8. returns the correct application date and existing status unchanged", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] Date Status Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const beforeApply = new Date();
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    const detail = await getApplicationForEmployer(applyResult.applicationId, job.id);

    expect(detail?.status).toBe("received");
    const appliedDate = new Date(detail!.appliedDate);
    expect(appliedDate.getTime()).not.toBeNaN();
    expect(appliedDate.getTime()).toBeGreaterThanOrEqual(beforeApply.getTime());
  });

  it("9, 10. never exposes resumeFileUrl or candidate email — only the documented fields are returned", async () => {
    const job = await createTestJob(employerA, {
      title: `[AI MODERATION TEST] No Leak Detail Job ${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      applicationMethod: "on_platform",
    });
    const applyResult = await applyToJob({ userId: candidateMinimal.userId, jobId: job.id });
    expect(applyResult.success).toBe(true);
    if (!applyResult.success) return;

    const detail = await getApplicationForEmployer(applyResult.applicationId, job.id);

    expect(detail).not.toBeNull();
    const returnedKeys = Object.keys(detail!).sort();
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
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("resumeFileUrl");
    expect(serialized.toLowerCase()).not.toContain("@example.invalid");
  });
});

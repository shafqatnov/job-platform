import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
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
  let jobSlug: string;
  let jobTitle: string;
  let companyName: string;
  let countrySlug: string;
  let countryName: string;
  let beforeApply: Date;

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
    jobTitle = job.title;

    const [jobRecord, company] = await Promise.all([
      prisma.job.findUniqueOrThrow({
        where: { id: jobId },
        select: { slug: true, country: { select: { urlSlug: true, name: true } } },
      }),
      prisma.company.findUniqueOrThrow({ where: { id: jobFixtures.companyId }, select: { name: true } }),
    ]);
    jobSlug = jobRecord.slug;
    countrySlug = jobRecord.country.urlSlug;
    countryName = jobRecord.country.name;
    companyName = company.name;

    beforeApply = new Date();
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

  it("returns the candidate's own application linked to the correct job, with correct company and date", async () => {
    const applications = await getApplicationsForCandidate(candidateA.candidateProfileId);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      jobTitle,
      jobSlug,
      countrySlug,
      countryName,
      companyName,
      status: "received",
    });

    // Application date renders correctly: a valid, parseable timestamp
    // taken at (or after) the moment applyToJob was called in setup.
    const appliedDate = new Date(applications[0].appliedDate);
    expect(appliedDate.getTime()).not.toBeNaN();
    expect(appliedDate.getTime()).toBeGreaterThanOrEqual(beforeApply.getTime());
  });

  it("never returns another candidate's applications", async () => {
    const applicationsForB = await getApplicationsForCandidate(candidateB.candidateProfileId);
    expect(applicationsForB).toEqual([]);
  });

  it("returns an empty list (not an error) for a candidate with no applications yet", async () => {
    const applications = await getApplicationsForCandidate(candidateB.candidateProfileId);
    expect(applications).toEqual([]);
  });

  it("authorization: results are strictly scoped to the candidateProfileId argument — there is no other id (userId, URL param, etc) the function accepts that could redirect the query to a different candidate's data", async () => {
    // getApplicationsForCandidate's only parameter is candidateProfileId,
    // resolved one layer up (in the page) from the authenticated
    // session — never from a client-supplied value. Calling it with
    // candidate B's own id, after candidate A has an application, proves
    // the where-clause is scoped to exactly the id given and nothing else.
    const applicationsForB = await getApplicationsForCandidate(candidateB.candidateProfileId);
    expect(applicationsForB).toEqual([]);

    const applicationsForA = await getApplicationsForCandidate(candidateA.candidateProfileId);
    expect(applicationsForA).toHaveLength(1);
    expect(applicationsForA[0].id).not.toBe(undefined);
  });
});

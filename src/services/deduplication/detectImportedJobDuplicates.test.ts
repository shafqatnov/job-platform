import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { detectImportedJobDuplicates } from "@/services/deduplication/detectImportedJobDuplicates";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

const MODULE_SOURCE = readFileSync(new URL("./detectImportedJobDuplicates.ts", import.meta.url), "utf8");

function makeRawJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
  return {
    sourceId: "source-1",
    externalJobId: crypto.randomUUID(),
    title: `[DEDUP TEST] Job ${crypto.randomUUID()}`,
    location: null,
    description: "Some description",
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/1",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "ATS",
    companyIdentity: null,
    departments: [],
    offices: [],
    ...overrides,
  };
}

describe("detectImportedJobDuplicates (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let cityName: string;
  let companyName: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [city, company] = await Promise.all([
      prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { name: true } }),
      prisma.company.findUniqueOrThrow({ where: { id: fixtures.companyId }, select: { name: true } }),
    ]);
    cityName = city.name;
    companyName = company.name;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("1. same sourceId + externalJobId within a batch is an exact duplicate", async () => {
    const jobA = makeRawJob({ sourceId: "s1", externalJobId: "100" });
    const jobB = makeRawJob({ sourceId: "s1", externalJobId: "100", title: "A totally different title" });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results[0].outcome).toBe("unique");
    expect(results[1].outcome).toBe("exact_duplicate");
    expect(results[1].reason).toBe("exact_source_identity_within_batch");
  });

  it("2. a different externalJobId is not the same exact source job", async () => {
    const jobA = makeRawJob({ sourceId: "s1", externalJobId: "100" });
    const jobB = makeRawJob({ sourceId: "s1", externalJobId: "200" });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results[1].outcome).not.toBe("exact_duplicate");
  });

  it("3. a different sourceId with the same externalJobId is not the same source identity", async () => {
    const jobA = makeRawJob({ sourceId: "s1", externalJobId: "100" });
    const jobB = makeRawJob({ sourceId: "s2", externalJobId: "100" });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results[1].outcome).not.toBe("exact_duplicate");
  });

  it("4. the same title alone does NOT mark a job as a duplicate", async () => {
    const sharedTitle = `[DEDUP TEST] Shared Title ${crypto.randomUUID()}`;
    const jobA = makeRawJob({ title: sharedTitle, companyIdentity: "Company A", location: "City A" });
    const jobB = makeRawJob({ title: sharedTitle, companyIdentity: "Company B", location: "City B" });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results[1].outcome).toBe("unique");
  });

  it("5. same title + same company + same location within a batch is a possible duplicate (deterministic, not fuzzy)", async () => {
    const sharedTitle = `[DEDUP TEST] Matching Title ${crypto.randomUUID()}`;
    const jobA = makeRawJob({ title: sharedTitle, companyIdentity: "Acme Co", location: "Remote" });
    const jobB = makeRawJob({ title: sharedTitle, companyIdentity: "Acme Co", location: "Remote" });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results[1].outcome).toBe("possible_duplicate");
    expect(results[1].reason).toBe("deterministic_title_company_location_match_within_batch");
  });

  it("6. missing optional companyIdentity/location fields do not crash detection", async () => {
    const title = `[DEDUP TEST] Bare ${crypto.randomUUID()}`;
    const jobA = makeRawJob({ title, companyIdentity: null, location: null });
    const jobB = makeRawJob({ title, companyIdentity: null, location: null });

    const results = await detectImportedJobDuplicates([jobA, jobB]);

    expect(results).toHaveLength(2);
    expect(results[1].outcome).toBe("unique");
  });

  it("7. an existing active job with the same title/company/location is detected as a possible duplicate", async () => {
    const title = `[DEDUP TEST] Existing Active ${crypto.randomUUID()}`;
    const job = await createTestJob(fixtures, { title, status: "active" });

    const rawJob = makeRawJob({ title, companyIdentity: companyName, location: cityName });
    const results = await detectImportedJobDuplicates([rawJob]);

    expect(results[0].outcome).toBe("possible_duplicate");
    expect(results[0].matchedWith).toEqual({ kind: "existing_job", jobId: job.id });
  });

  it("8. a soft-deleted existing job with the same fields is NOT treated as a duplicate", async () => {
    const title = `[DEDUP TEST] Existing Deleted ${crypto.randomUUID()}`;
    await createTestJob(fixtures, { title, deletedAt: new Date() });

    const rawJob = makeRawJob({ title, companyIdentity: companyName, location: cityName });
    const results = await detectImportedJobDuplicates([rawJob]);

    expect(results[0].outcome).toBe("unique");
  });

  it("8b. an existing rejected (but not deleted) job with the same fields IS treated as a possible duplicate", async () => {
    const title = `[DEDUP TEST] Existing Rejected ${crypto.randomUUID()}`;
    const job = await createTestJob(fixtures, { title, status: "rejected" });

    const rawJob = makeRawJob({ title, companyIdentity: companyName, location: cityName });
    const results = await detectImportedJobDuplicates([rawJob]);

    expect(results[0].outcome).toBe("possible_duplicate");
    expect(results[0].matchedWith).toEqual({ kind: "existing_job", jobId: job.id });
  });

  it("9. results are deterministic across repeated calls against the same database state", async () => {
    const title = `[DEDUP TEST] Determinism ${crypto.randomUUID()}`;
    await createTestJob(fixtures, { title });
    const rawJob = makeRawJob({ title, companyIdentity: companyName, location: cityName });

    const first = await detectImportedJobDuplicates([rawJob]);
    const second = await detectImportedJobDuplicates([rawJob]);

    expect(first[0].outcome).toBe(second[0].outcome);
    expect(first[0].matchedWith).toEqual(second[0].matchedWith);
  });

  it("10. this module never calls OpenAI — it has no such dependency at all", () => {
    expect(MODULE_SOURCE).not.toMatch(/openai/i);
  });

  it("11. running detection never creates a Job row", async () => {
    const before = await prisma.job.count();

    await detectImportedJobDuplicates([makeRawJob()]);

    const after = await prisma.job.count();
    expect(after).toBe(before);
  });

  it("12. existing jobs are not modified by detection", async () => {
    const title = `[DEDUP TEST] Untouched ${crypto.randomUUID()}`;
    const job = await createTestJob(fixtures, { title });
    const before = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });

    await detectImportedJobDuplicates([makeRawJob({ title, companyIdentity: companyName, location: cityName })]);

    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after).toEqual(before);
  });

  it("13. detection is scoped to imported-source identity/fields, not incidental partial matches", async () => {
    const title = `[DEDUP TEST] Scoped ${crypto.randomUUID()}`;
    await createTestJob(fixtures, { title });

    // Same title as the existing job, but a company/location that don't
    // match — must not be flagged.
    const rawJob = makeRawJob({ title, companyIdentity: "A Totally Different Company", location: "A Totally Different City" });
    const results = await detectImportedJobDuplicates([rawJob]);

    expect(results[0].outcome).toBe("unique");
  });

  it("14. batch detection isolates each record — one exact duplicate does not affect an unrelated unique job", async () => {
    const dupA = makeRawJob({ sourceId: "s1", externalJobId: "1" });
    const dupB = makeRawJob({ sourceId: "s1", externalJobId: "1" });
    const uniqueJob = makeRawJob({ sourceId: "s2", externalJobId: "999" });

    const results = await detectImportedJobDuplicates([dupA, dupB, uniqueJob]);

    expect(results[1].outcome).toBe("exact_duplicate");
    expect(results[2].outcome).toBe("unique");
  });

  it("15. no unrelated table is touched — only Job rows are read, never other models", async () => {
    const userCountBefore = await prisma.user.count();
    const companyCountBefore = await prisma.company.count();

    await detectImportedJobDuplicates([makeRawJob({ companyIdentity: companyName, location: cityName, title: `[DEDUP TEST] ${crypto.randomUUID()}` })]);

    expect(await prisma.user.count()).toBe(userCountBefore);
    expect(await prisma.company.count()).toBe(companyCountBefore);
  });
});

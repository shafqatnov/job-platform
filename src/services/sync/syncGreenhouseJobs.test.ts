import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSourceRow } from "@/services/admin/jobSources";
import type { GreenhouseRawJob } from "@/services/connectors/greenhouseConnector";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import type { PublishImportedJobResult } from "@/services/publishing/publishImportedJob";

const listJobSourcesMock = vi.fn();
vi.mock("@/services/admin/jobSources", () => ({
  listJobSources: () => listJobSourcesMock(),
}));

const runGreenhouseImporterMock = vi.fn();
vi.mock("@/services/importers/greenhouseImporter", () => ({
  runGreenhouseImporter: () => runGreenhouseImporterMock(),
}));

const detectImportedJobDuplicatesMock = vi.fn();
vi.mock("@/services/deduplication/detectImportedJobDuplicates", () => ({
  detectImportedJobDuplicates: (...args: unknown[]) => detectImportedJobDuplicatesMock(...args),
}));

const normalizeImportedJobMock = vi.fn();
vi.mock("@/services/ai/normalizeImportedJob", () => ({
  normalizeImportedJob: (...args: unknown[]) => normalizeImportedJobMock(...args),
}));

const ingestImportedJobMock = vi.fn();
vi.mock("@/services/publishing/publishImportedJob", () => ({
  ingestImportedJob: (...args: unknown[]) => ingestImportedJobMock(...args),
}));

const { syncGreenhouseJobs } = await import("@/services/sync/syncGreenhouseJobs");

const TARGET_SOURCE_ID = "gh-source-1";
const OTHER_SOURCE_ID = "gh-source-2";

function makeSource(overrides: Partial<JobSourceRow> = {}): JobSourceRow {
  return {
    id: TARGET_SOURCE_ID,
    name: "Greenhouse - Acme Co",
    sourceType: "ATS",
    baseEndpoint: "https://boards-api.greenhouse.io/v1/boards/acme-co/jobs",
    enabled: false,
    attributionRequired: true,
    refreshIntervalMinutes: null,
    status: "not_configured",
    hasCredentialConfigured: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: "greenhouse",
    authorizationStatus: "unverified",
    authorizationVerifiedAt: null,
    authorizationReference: null,
    ...overrides,
  };
}

function makeRawJob(overrides: Partial<GreenhouseRawJob> = {}): GreenhouseRawJob {
  return {
    sourceId: TARGET_SOURCE_ID,
    externalJobId: "1",
    title: "Engineer",
    location: "London",
    description: "A genuine, real description of the role and its responsibilities.",
    sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/1",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "ATS",
    companyIdentity: "Acme Co",
    departments: [],
    offices: [],
    ...overrides,
  };
}

function makeGoodNormalization(overrides: Record<string, unknown> = {}): NormalizeImportedJobResult {
  return {
    ok: true,
    result: {
      sourceId: TARGET_SOURCE_ID,
      externalJobId: "1",
      sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/1",
      normalizedTitle: "Engineer",
      normalizedDescription: "A genuine, real description.",
      country: "United Kingdom",
      city: "London",
      category: "Engineering",
      skills: [],
      experienceSummary: null,
      salary: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: null,
      quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
      ...overrides,
    },
  } as NormalizeImportedJobResult;
}

describe("syncGreenhouseJobs", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runGreenhouseImporterMock.mockReset();
    detectImportedJobDuplicatesMock.mockReset();
    normalizeImportedJobMock.mockReset();
    ingestImportedJobMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. a source id that doesn't exist in the registry stops safely with zero Greenhouse requests", async () => {
    listJobSourcesMock.mockResolvedValue([]);

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: "source_not_found" });
    expect(runGreenhouseImporterMock).not.toHaveBeenCalled();
  });

  it("2. an unverified source stops safely with zero Greenhouse requests", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "unverified", enabled: false })]);

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(runGreenhouseImporterMock).not.toHaveBeenCalled();
  });

  it("3. a verified but disabled source stops safely with zero Greenhouse requests", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: false })]);

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(runGreenhouseImporterMock).not.toHaveBeenCalled();
  });

  it("4. a verified + enabled source proceeds, calls the existing importer exactly once, and produces a summary", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    const rawJob = makeRawJob();
    runGreenhouseImporterMock.mockResolvedValue({
      results: [{ sourceId: TARGET_SOURCE_ID, sourceName: "Greenhouse - Acme Co", success: true, importedRawJobCount: 1, jobs: [rawJob] }],
      totalSourcesConsidered: 1,
      totalSourcesEligible: 1,
      totalRawJobsImported: 1,
    });
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    const published: PublishImportedJobResult = { outcome: "published", jobId: "job-1", reviewId: "review-1" };
    ingestImportedJobMock.mockResolvedValue(published);

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(runGreenhouseImporterMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceId).toBe(TARGET_SOURCE_ID);
      expect(result.sourceName).toBe("Greenhouse - Acme Co");
      expect(result.fetchedCount).toBe(1);
      expect(result.publishedCount).toBe(1);
    }
  });

  it("5. only the requested source's own jobs are processed, even when the importer's shared fetch also returned another board's jobs", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    const targetJob = makeRawJob({ externalJobId: "target-1" });
    const otherJob = makeRawJob({ sourceId: OTHER_SOURCE_ID, externalJobId: "other-1" });
    runGreenhouseImporterMock.mockResolvedValue({
      results: [
        { sourceId: TARGET_SOURCE_ID, sourceName: "Greenhouse - Acme Co", success: true, importedRawJobCount: 1, jobs: [targetJob] },
        { sourceId: OTHER_SOURCE_ID, sourceName: "Greenhouse - Other Co", success: true, importedRawJobCount: 1, jobs: [otherJob] },
      ],
      totalSourcesConsidered: 2,
      totalSourcesEligible: 2,
      totalRawJobsImported: 2,
    });
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: targetJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedCount).toBe(1);
    }
    // detectImportedJobDuplicates (the first pipeline stage after
    // validation) must only ever see the target source's own job.
    const [duplicateCallArg] = detectImportedJobDuplicatesMock.mock.calls[0];
    expect(duplicateCallArg).toHaveLength(1);
    expect(duplicateCallArg[0].externalJobId).toBe("target-1");
    expect(ingestImportedJobMock).toHaveBeenCalledTimes(1);
  });

  it("6. a source id the importer's own eligibility check doesn't recognize stops safely as not_a_greenhouse_source", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    runGreenhouseImporterMock.mockResolvedValue({
      results: [],
      totalSourcesConsidered: 1,
      totalSourcesEligible: 0,
      totalRawJobsImported: 0,
    });

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: "not_a_greenhouse_source" });
    expect(ingestImportedJobMock).not.toHaveBeenCalled();
  });

  it("7. a fetch failure for this specific source is reported, not silently treated as zero jobs", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    runGreenhouseImporterMock.mockResolvedValue({
      results: [{ sourceId: TARGET_SOURCE_ID, sourceName: "Greenhouse - Acme Co", success: false, importedRawJobCount: 0, error: "Could not reach the Greenhouse job board." }],
      totalSourcesConsidered: 1,
      totalSourcesEligible: 1,
      totalRawJobsImported: 0,
    });

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(result).toEqual({ ok: false, reason: "fetch_failed", detail: "Could not reach the Greenhouse job board." });
    expect(ingestImportedJobMock).not.toHaveBeenCalled();
  });

  it("8. an exact duplicate is never re-published and skips the AI call entirely", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    const rawJob = makeRawJob();
    runGreenhouseImporterMock.mockResolvedValue({
      results: [{ sourceId: TARGET_SOURCE_ID, sourceName: "Greenhouse - Acme Co", success: true, importedRawJobCount: 1, jobs: [rawJob] }],
      totalSourcesConsidered: 1,
      totalSourcesEligible: 1,
      totalRawJobsImported: 1,
    });
    detectImportedJobDuplicatesMock.mockResolvedValue([
      { outcome: "exact_duplicate", reason: "exact_source_identity_within_batch", matchedWith: null, job: rawJob },
    ]);
    ingestImportedJobMock.mockResolvedValue({ outcome: "rejected", reviewId: "review-1" });

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(normalizeImportedJobMock).not.toHaveBeenCalled();
    expect(ingestImportedJobMock).toHaveBeenCalledTimes(1);
    const [callArg] = ingestImportedJobMock.mock.calls[0];
    expect(callArg.decision.decision).toBe("do_not_publish");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.exactDuplicateCount).toBe(1);
    }
  });

  it("9. this module never imports Prisma directly — it can never write a Job/Country/City row itself, only via the existing publishing service", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./syncGreenhouseJobs.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']@\/lib\/prisma["']/);
  });

  it("10. no secret or credential value ever appears in the sync summary", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ authorizationStatus: "verified", enabled: true })]);
    const rawJob = makeRawJob();
    runGreenhouseImporterMock.mockResolvedValue({
      results: [{ sourceId: TARGET_SOURCE_ID, sourceName: "Greenhouse - Acme Co", success: true, importedRawJobCount: 1, jobs: [rawJob] }],
      totalSourcesConsidered: 1,
      totalSourcesEligible: 1,
      totalRawJobsImported: 1,
    });
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

    const result = await syncGreenhouseJobs(TARGET_SOURCE_ID);

    expect(JSON.stringify(result)).not.toMatch(/credentialEnvVarName|token|secret|api[_-]?key/i);
  });
});

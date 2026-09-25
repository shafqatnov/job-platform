import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSourceRow } from "@/services/admin/jobSources";
import type { AdzunaRawJob } from "@/services/connectors/adzunaConnector";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import type { PublishImportedJobResult } from "@/services/publishing/publishImportedJob";

const listJobSourcesMock = vi.fn();
vi.mock("@/services/admin/jobSources", () => ({
  listJobSources: () => listJobSourcesMock(),
}));

const runAdzunaImporterMock = vi.fn();
vi.mock("@/services/importers/adzunaImporter", () => ({
  runAdzunaOilAndGasImporter: () => runAdzunaImporterMock(),
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

const findCountryByIsoCodeMock = vi.fn();
vi.mock("@/services/jobs/referenceData", () => ({
  findCountryByIsoCode: (...args: unknown[]) => findCountryByIsoCodeMock(...args),
}));

// Realistic default: gb/us (the only Adzuna countries used in this
// suite's fixtures) resolve to a real Country row, matching production
// truth — individual tests override this to null to exercise the
// "genuinely unresolvable" fallback path.
function defaultCountryLookup(isoCode: string) {
  const normalized = isoCode.toLowerCase();
  if (normalized === "gb") return Promise.resolve({ id: "country-gb", slug: "uk", name: "United Kingdom" });
  if (normalized === "us") return Promise.resolve({ id: "country-us", slug: "usa", name: "United States" });
  return Promise.resolve(null);
}

const { syncAdzunaJobs } = await import("@/services/sync/syncAdzunaJobs");
const SOURCE = readFileSync(new URL("./syncAdzunaJobs.ts", import.meta.url), "utf8");

function makeSource(overrides: Partial<JobSourceRow> = {}): JobSourceRow {
  return {
    id: "adzuna-source-1",
    name: "Adzuna",
    sourceType: "API",
    baseEndpoint: "https://api.adzuna.com/v1/api",
    enabled: false,
    attributionRequired: true,
    refreshIntervalMinutes: null,
    status: "connector_ready_awaiting_authorization",
    hasCredentialConfigured: true,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: "adzuna",
    authorizationStatus: "unverified",
    authorizationVerifiedAt: null,
    authorizationReference: null,
    ...overrides,
  };
}

function makeRawJob(overrides: Partial<AdzunaRawJob> = {}): AdzunaRawJob {
  return {
    sourceId: "adzuna-source-1",
    externalJobId: "1",
    title: "Engineer",
    location: "London",
    description: "A genuine, real description of the role and its responsibilities.",
    sourceUrl: "https://www.adzuna.co.uk/jobs/land/ad/1",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "API",
    companyIdentity: "Acme Co",
    departments: [],
    offices: [],
    adzunaCountryCode: "gb",
    adzunaCategory: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryIsPredicted: false,
    contractType: null,
    contractTime: null,
    ...overrides,
  };
}

function makeGoodNormalization(overrides: Record<string, unknown> = {}): NormalizeImportedJobResult {
  return {
    ok: true,
    result: {
      sourceId: "adzuna-source-1",
      externalJobId: "1",
      sourceUrl: "https://www.adzuna.co.uk/jobs/land/ad/1",
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

function importResultWith(jobs: AdzunaRawJob[], eligible = true) {
  return {
    results: [],
    totalSourcesConsidered: 1,
    totalSourcesEligible: eligible,
    totalRawJobsImported: jobs.length,
    jobs,
  };
}

describe("syncAdzunaJobs", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runAdzunaImporterMock.mockReset();
    detectImportedJobDuplicatesMock.mockReset();
    normalizeImportedJobMock.mockReset();
    ingestImportedJobMock.mockReset();
    findCountryByIsoCodeMock.mockReset();
    findCountryByIsoCodeMock.mockImplementation(defaultCountryLookup);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. an unverified source stops safely with zero Adzuna requests", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: false, authorizationStatus: "unverified" })]);

    const result = await syncAdzunaJobs();

    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(runAdzunaImporterMock).not.toHaveBeenCalled();
    expect(ingestImportedJobMock).not.toHaveBeenCalled();
  });

  it("2. a verified but disabled source stops safely with zero Adzuna requests", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: false, authorizationStatus: "verified" })]);

    const result = await syncAdzunaJobs();

    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(runAdzunaImporterMock).not.toHaveBeenCalled();
  });

  it("a missing Adzuna source row stops safely", async () => {
    listJobSourcesMock.mockResolvedValue([]);

    const result = await syncAdzunaJobs();

    expect(result).toEqual({ ok: false, reason: "source_not_found" });
    expect(runAdzunaImporterMock).not.toHaveBeenCalled();
  });

  it("3. a verified + enabled source proceeds and produces a summary", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    const rawJob = makeRawJob();
    runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    const published: PublishImportedJobResult = { outcome: "published", jobId: "job-1", reviewId: "review-1" };
    ingestImportedJobMock.mockResolvedValue(published);

    const result = await syncAdzunaJobs();

    expect(runAdzunaImporterMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedCount).toBe(1);
      expect(result.publishedCount).toBe(1);
    }
  });

  it("a race where the importer itself finds the source ineligible also stops safely without publishing", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    runAdzunaImporterMock.mockResolvedValue(importResultWith([], false));

    const result = await syncAdzunaJobs();

    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(ingestImportedJobMock).not.toHaveBeenCalled();
  });

  it("4. an exact duplicate is never re-published and skips the AI call entirely", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    const rawJob = makeRawJob();
    runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
    detectImportedJobDuplicatesMock.mockResolvedValue([
      { outcome: "exact_duplicate", reason: "exact_source_identity_within_batch", matchedWith: null, job: rawJob },
    ]);
    ingestImportedJobMock.mockResolvedValue({ outcome: "rejected", reviewId: "review-1" });

    const result = await syncAdzunaJobs();

    expect(normalizeImportedJobMock).not.toHaveBeenCalled();
    expect(ingestImportedJobMock).toHaveBeenCalledTimes(1);
    const [callArg] = ingestImportedJobMock.mock.calls[0];
    expect(callArg.decision.decision).toBe("do_not_publish");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.exactDuplicateCount).toBe(1);
    }
  });

  it("5+10. this module never imports Prisma directly — it can never write a Job/Country/City row itself, only via the existing publishing service", () => {
    expect(SOURCE).not.toMatch(/from ["']@\/lib\/prisma["']/);
  });

  it("7. only one Adzuna fetch call is made per sync run, regardless of job count (bounded, not a burst)", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    const jobs = [makeRawJob({ externalJobId: "1" }), makeRawJob({ externalJobId: "2" }), makeRawJob({ externalJobId: "3" })];
    runAdzunaImporterMock.mockResolvedValue(importResultWith(jobs));
    detectImportedJobDuplicatesMock.mockResolvedValue(jobs.map((job) => ({ outcome: "unique" as const, reason: null, matchedWith: null, job })));
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    ingestImportedJobMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });

    await syncAdzunaJobs();

    expect(runAdzunaImporterMock).toHaveBeenCalledTimes(1);
    expect(normalizeImportedJobMock).toHaveBeenCalledTimes(3);
  });

  it("8. an AI normalization failure for one job is handled safely and does not stop the batch", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    const jobs = [makeRawJob({ externalJobId: "1" }), makeRawJob({ externalJobId: "2" })];
    runAdzunaImporterMock.mockResolvedValue(importResultWith(jobs));
    detectImportedJobDuplicatesMock.mockResolvedValue(jobs.map((job) => ({ outcome: "unique" as const, reason: null, matchedWith: null, job })));
    normalizeImportedJobMock
      .mockResolvedValueOnce({ ok: false, error: "We couldn't analyze this imported job right now. Please try again later." })
      .mockResolvedValueOnce(makeGoodNormalization());
    ingestImportedJobMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });

    const result = await syncAdzunaJobs();

    expect(ingestImportedJobMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("9. when even the deterministic Adzuna country mapping can't resolve (a genuinely unrecognized code), an AI-uncertain location still routes to admin_review — the Unknown Location Review safety net is preserved", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    findCountryByIsoCodeMock.mockResolvedValue(null); // simulates the safety-net path, not a normal gb/us case
    const rawJob = makeRawJob();
    runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization({ country: null, city: null }));
    ingestImportedJobMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });

    await syncAdzunaJobs();

    const [callArg] = ingestImportedJobMock.mock.calls[0];
    expect(callArg.decision.decision).toBe("admin_review");
    expect(callArg.decision.reasons).toContain("location_uncertain");
  });

  describe("Adzuna-specific confidence optimizations", () => {
    it("a known gb/us country resolves deterministically even when the AI can't infer it from ambiguous text — no location_uncertain, and the resolved value flows into publishing", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob({ adzunaCountryCode: "us", location: "Halstad, Norman County" });
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      // The AI genuinely can't tell the country from this text alone — exactly the real, observed case.
      normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization({ country: null, city: "Halstad" }));
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      expect(findCountryByIsoCodeMock).toHaveBeenCalledWith("us");
      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.normalization.result.country).toBe("United States");
      expect(callArg.decision.reasons).not.toContain("location_uncertain");
    });

    it("does not call the deterministic country lookup for an exact duplicate (still skips all AI-adjacent work for guaranteed do_not_publish jobs)", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([
        { outcome: "exact_duplicate", reason: "exact_source_identity_within_batch", matchedWith: null, job: rawJob },
      ]);
      ingestImportedJobMock.mockResolvedValue({ outcome: "rejected", reviewId: "review-1" });

      await syncAdzunaJobs();

      expect(findCountryByIsoCodeMock).not.toHaveBeenCalled();
    });

    it("a \"weak\" quality verdict with zero suspicious signals is discounted — it never triggers content_quality_weak or missing_important_fields, and the job can reach auto_publish", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      normalizeImportedJobMock.mockResolvedValue(
        makeGoodNormalization({
          quality: {
            contentQuality: "weak",
            concerns: ["Short description"],
            missingImportantFields: ["Detailed responsibilities"],
            suspiciousSignals: [],
          },
        })
      );
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.decision.reasons).not.toContain("content_quality_weak");
      expect(callArg.decision.reasons).not.toContain("missing_important_fields");
      expect(callArg.decision.decision).toBe("auto_publish");
    });

    it("a \"poor\" quality verdict is NEVER discounted — genuinely poor content still routes to review regardless of source", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      normalizeImportedJobMock.mockResolvedValue(
        makeGoodNormalization({
          quality: { contentQuality: "poor", concerns: ["Templated, low-effort listing"], missingImportantFields: [], suspiciousSignals: [] },
        })
      );
      ingestImportedJobMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.decision.reasons).toContain("content_quality_poor");
      expect(callArg.decision.decision).toBe("admin_review");
    });

    it("a suspicious signal is NEVER discounted, even when quality is only \"weak\" — still routes to review", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      normalizeImportedJobMock.mockResolvedValue(
        makeGoodNormalization({
          quality: { contentQuality: "weak", concerns: [], missingImportantFields: [], suspiciousSignals: ["Templated filler text"] },
        })
      );
      ingestImportedJobMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.decision.reasons).toContain("suspicious_signals_present");
      expect(callArg.decision.decision).toBe("admin_review");
    });

    it("strips a trailing source-truncation note from the normalized description before publishing", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      normalizeImportedJobMock.mockResolvedValue(
        makeGoodNormalization({
          normalizedDescription:
            'Join the RAC as a Mobile Vehicle Technician. The role offers a competitive base salary. The supplied description is truncated after "roadside resc…"',
        })
      );
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      const description: string = callArg.normalization.result.normalizedDescription;
      expect(description).not.toMatch(/supplied description/i);
      expect(description).not.toMatch(/truncat/i);
      expect(description).toContain("Join the RAC as a Mobile Vehicle Technician.");
      expect(description).toContain("The role offers a competitive base salary.");
    });

    it("also strips a bracketed source-truncation note without leaving a stray bracket behind", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      normalizeImportedJobMock.mockResolvedValue(
        makeGoodNormalization({
          normalizedDescription: "General Managers lead their team and drive results. [Description appears truncated in the source.]",
        })
      );
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      const description: string = callArg.normalization.result.normalizedDescription;
      expect(description).toBe("General Managers lead their team and drive results.");
    });

    it("never strips genuine content that merely mentions unrelated words like 'source' or 'truncated' without both appearing together in a source-reference sentence", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      const genuineDescription =
        "This role reports to the Head of Engineering. Freight is sourced from major retail partners across the region.";
      normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization({ normalizedDescription: genuineDescription }));
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.normalization.result.normalizedDescription).toBe(genuineDescription);
    });

    it("never leaves an empty description even if the entire text happens to match the truncation-note pattern", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
      const onlyNote = "The source description is truncated.";
      normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization({ normalizedDescription: onlyNote }));
      ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

      await syncAdzunaJobs();

      const [callArg] = ingestImportedJobMock.mock.calls[0];
      expect(callArg.normalization.result.normalizedDescription).toBe(onlyNote);
    });

    it("does not run the truncation-note stripper for an exact duplicate", async () => {
      listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
      const rawJob = makeRawJob();
      runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
      detectImportedJobDuplicatesMock.mockResolvedValue([
        { outcome: "exact_duplicate", reason: "exact_source_identity_within_batch", matchedWith: null, job: rawJob },
      ]);
      ingestImportedJobMock.mockResolvedValue({ outcome: "rejected", reviewId: "review-1" });

      await syncAdzunaJobs();

      expect(normalizeImportedJobMock).not.toHaveBeenCalled();
    });
  });

  it("11+12. no secret or credential value ever appears in the sync summary", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: true, authorizationStatus: "verified" })]);
    const rawJob = makeRawJob();
    runAdzunaImporterMock.mockResolvedValue(importResultWith([rawJob]));
    detectImportedJobDuplicatesMock.mockResolvedValue([{ outcome: "unique", reason: null, matchedWith: null, job: rawJob }]);
    normalizeImportedJobMock.mockResolvedValue(makeGoodNormalization());
    ingestImportedJobMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });

    const result = await syncAdzunaJobs();

    expect(JSON.stringify(result)).not.toMatch(/app_id|app_key|credentialEnvVarName/i);
    expect(SOURCE).not.toMatch(/process\.env\.ADZUNA/);
  });

  it("14. no publish occurs while the source remains disabled/unverified", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: false, authorizationStatus: "unverified" })]);

    await syncAdzunaJobs();

    expect(ingestImportedJobMock).not.toHaveBeenCalled();
  });
});

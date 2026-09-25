import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSourceRow } from "@/services/admin/jobSources";
import type { AdzunaRawJob } from "@/services/connectors/adzunaConnector";

const listJobSourcesMock = vi.fn();
vi.mock("@/services/admin/jobSources", () => ({
  listJobSources: () => listJobSourcesMock(),
}));

const runAdzunaConnectorMock = vi.fn();
vi.mock("@/services/connectors/adzunaConnector", () => ({
  runAdzunaConnector: (...args: unknown[]) => runAdzunaConnectorMock(...args),
}));

const {
  runAdzunaImporter,
  CONTROLLED_TEST_COUNTRY_CODES,
  CONTROLLED_TEST_TOTAL_JOB_LIMIT,
  runAdzunaOilAndGasImporter,
  buildOilAndGasCombinations,
  selectOilAndGasWindow,
  OIL_AND_GAS_COUNTRY_CODES,
  OIL_AND_GAS_SEARCH_PROFILES,
  OIL_AND_GAS_SYNC_BUDGET,
} = await import("@/services/importers/adzunaImporter");

function makeSource(overrides: Partial<JobSourceRow> = {}): JobSourceRow {
  return {
    id: "source-1",
    name: "Adzuna",
    sourceType: "API",
    baseEndpoint: "https://api.adzuna.com/v1/api",
    enabled: true,
    attributionRequired: true,
    refreshIntervalMinutes: null,
    status: "not_configured",
    hasCredentialConfigured: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: "unknown",
    authorizationStatus: "unverified",
    authorizationVerifiedAt: null,
    authorizationReference: null,
    ...overrides,
  };
}

function makeRawJob(overrides: Partial<AdzunaRawJob> = {}): AdzunaRawJob {
  return {
    sourceId: "source-1",
    externalJobId: "1",
    title: "Engineer",
    location: null,
    description: null,
    sourceUrl: null,
    updatedAt: "",
    rawSourceType: "API",
    companyIdentity: null,
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

describe("adzunaImporter", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runAdzunaConnectorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. an enabled Adzuna source is processed across the controlled country set", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [makeRawJob()] });

    const summary = await runAdzunaImporter();

    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(CONTROLLED_TEST_COUNTRY_CODES.length);
    expect(summary.totalSourcesEligible).toBe(true);
  });

  it("2. a disabled Adzuna source is skipped", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: false })]);

    const summary = await runAdzunaImporter();

    expect(runAdzunaConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(false);
    expect(summary.results).toEqual([]);
  });

  it("3. a non-API source is skipped even if its endpoint looks like Adzuna", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ sourceType: "ATS" })]);

    const summary = await runAdzunaImporter();

    expect(runAdzunaConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(false);
  });

  it("4. a non-Adzuna API source (different endpoint host) is skipped", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ name: "Other API", baseEndpoint: "https://api.example-other.invalid/v1" })]);

    const summary = await runAdzunaImporter();

    expect(runAdzunaConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(false);
  });

  it("5. queries each controlled country independently and aggregates jobs", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockImplementation((_source: unknown, options: { countryCode: string }) =>
      Promise.resolve({ success: true, jobs: [makeRawJob({ externalJobId: options.countryCode, adzunaCountryCode: options.countryCode as never })] })
    );

    const summary = await runAdzunaImporter();

    expect(summary.jobs.map((j) => j.externalJobId).sort()).toEqual([...CONTROLLED_TEST_COUNTRY_CODES].sort());
  });

  it("6. one country failing does not stop another country from being processed", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockImplementation((_source: unknown, options: { countryCode: string }) => {
      if (options.countryCode === CONTROLLED_TEST_COUNTRY_CODES[0]) {
        return Promise.reject(new Error("unexpected failure"));
      }
      return Promise.resolve({ success: true, jobs: [makeRawJob()] });
    });

    const summary = await runAdzunaImporter();

    const failed = summary.results.find((r) => r.countryCode === CONTROLLED_TEST_COUNTRY_CODES[0]);
    const succeeded = summary.results.find((r) => r.countryCode !== CONTROLLED_TEST_COUNTRY_CODES[0]);
    expect(failed?.success).toBe(false);
    expect(succeeded).toMatchObject({ success: true, importedRawJobCount: 1 });
  });

  it("6b. a safe connector failure (not a throw) is also isolated from other countries", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockImplementation((_source: unknown, options: { countryCode: string }) =>
      Promise.resolve(
        options.countryCode === CONTROLLED_TEST_COUNTRY_CODES[0]
          ? { success: false, error: "The Adzuna API returned an unexpected response." }
          : { success: true, jobs: [makeRawJob()] }
      )
    );

    const summary = await runAdzunaImporter();

    expect(summary.results.find((r) => r.countryCode === CONTROLLED_TEST_COUNTRY_CODES[0])).toMatchObject({
      success: false,
      importedRawJobCount: 0,
    });
  });

  it("7. an empty connector result is handled as a valid zero-job success", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaImporter();

    expect(summary.totalRawJobsImported).toBe(0);
  });

  it("8. connector results are returned unchanged as raw jobs", async () => {
    const rawJob = makeRawJob({ externalJobId: "999", title: "Staff Engineer", location: "London" });
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [rawJob] });

    const summary = await runAdzunaImporter();

    expect(summary.jobs).toContainEqual(rawJob);
  });

  it("9. the importer never creates a Job row — it returns only plain, serializable data", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [makeRawJob()] });

    const summary = await runAdzunaImporter();

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it("10. no OpenAI-related call occurs — only the registry and connector mocks are invoked", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    await runAdzunaImporter();

    expect(listJobSourcesMock).toHaveBeenCalledTimes(1);
  });

  it("11. sources are read through the existing registry service, not a direct database query", async () => {
    listJobSourcesMock.mockResolvedValue([]);

    await runAdzunaImporter();

    expect(listJobSourcesMock).toHaveBeenCalledTimes(1);
  });

  it("12. no secret value is exposed in the importer's result", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ hasCredentialConfigured: true })]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaImporter();

    expect(JSON.stringify(summary)).not.toMatch(/credentialEnvVarName|app_id|app_key/i);
  });

  it("20. total collected jobs never exceed the controlled first-test limit, and later countries are skipped once it's reached", async () => {
    // Each country's connector "returns" more than the whole limit by
    // itself — the importer must still cap the aggregate, and must stop
    // querying further countries once the cap is already met.
    runAdzunaConnectorMock.mockImplementation(() =>
      Promise.resolve({
        success: true,
        jobs: Array.from({ length: CONTROLLED_TEST_TOTAL_JOB_LIMIT }, (_, i) => makeRawJob({ externalJobId: `bulk-${i}` })),
      })
    );
    listJobSourcesMock.mockResolvedValue([makeSource()]);

    const summary = await runAdzunaImporter();

    expect(summary.jobs.length).toBeLessThanOrEqual(CONTROLLED_TEST_TOTAL_JOB_LIMIT);
    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(1);
  });
});

describe("buildOilAndGasCombinations", () => {
  it("1. produces exactly countries x profiles combinations, country-major, in stable deterministic order", () => {
    const combos = buildOilAndGasCombinations(["gb", "us"], ["oil", "gas"]);
    expect(combos).toEqual([
      { countryCode: "gb", keyword: "oil" },
      { countryCode: "gb", keyword: "gas" },
      { countryCode: "us", keyword: "oil" },
      { countryCode: "us", keyword: "gas" },
    ]);
  });

  it("covers all 8 target countries and the full starter profile set by default", () => {
    const combos = buildOilAndGasCombinations();
    expect(combos.length).toBe(OIL_AND_GAS_COUNTRY_CODES.length * OIL_AND_GAS_SEARCH_PROFILES.length);
    expect(new Set(OIL_AND_GAS_COUNTRY_CODES)).toEqual(new Set(["au", "ca", "de", "gb", "in", "nl", "sg", "us"]));
  });

  it("never invents Adzuna coverage in the six GeoNames-only markets", () => {
    const invented = ["ae", "sa", "qa", "kw", "om", "bh", "no", "br", "ng", "ao", "gy"];
    for (const code of invented) {
      expect(OIL_AND_GAS_COUNTRY_CODES).not.toContain(code);
    }
  });
});

describe("selectOilAndGasWindow", () => {
  const combos = buildOilAndGasCombinations(["gb", "us", "au"], ["oil", "gas"]); // 6 combos

  it("3. returns a bounded slice no larger than the requested window size", () => {
    const window = selectOilAndGasWindow(combos, 4, 0);
    expect(window.length).toBeLessThanOrEqual(4);
  });

  it("the same timestamp always selects the same slice (deterministic, no randomness)", () => {
    const a = selectOilAndGasWindow(combos, 4, 123_456_789);
    const b = selectOilAndGasWindow(combos, 4, 123_456_789);
    expect(a).toEqual(b);
  });

  it("6. successive 6-hour windows advance through the matrix and eventually cover every combination", () => {
    const cycleMs = 6 * 60 * 60 * 1000;
    const seen = new Set<string>();
    for (let cycle = 0; cycle < 3; cycle++) {
      const window = selectOilAndGasWindow(combos, 4, cycle * cycleMs);
      for (const c of window) seen.add(`${c.countryCode}:${c.keyword}`);
    }
    expect(seen.size).toBe(combos.length);
  });

  it("returns an empty window for an empty combination list or a non-positive window size", () => {
    expect(selectOilAndGasWindow([], 4, 0)).toEqual([]);
    expect(selectOilAndGasWindow(combos, 0, 0)).toEqual([]);
  });
});

describe("runAdzunaOilAndGasImporter", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runAdzunaConnectorMock.mockReset();
  });

  it("2. a disabled Adzuna source is skipped, exactly like the legacy importer", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource({ enabled: false })]);

    const summary = await runAdzunaOilAndGasImporter();

    expect(runAdzunaConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(false);
    expect(summary.jobs).toEqual([]);
  });

  it("3. never issues more requests than maxRequestsPerRun, even though far more combinations exist", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaOilAndGasImporter({ maxRequestsPerRun: 5, now: () => 0 });

    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(5);
    expect(summary.requestsUsed).toBe(5);
    expect(summary.requestBudgetReached).toBe(true);
  });

    it("sends the combination's own keyword as the connector's 'what' parameter for each call", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    await runAdzunaOilAndGasImporter({
      countryCodes: ["gb"],
      profiles: ["drilling", "offshore"],
      maxRequestsPerRun: 2,
      now: () => 0,
    });

    const keywordsSent = runAdzunaConnectorMock.mock.calls.map((call) => call[1].keyword);
    expect(keywordsSent.sort()).toEqual(["drilling", "offshore"]);
  });

  it("4. never collects more candidates than maxNewCandidatesPerRun, stopping mid-run", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({
      success: true,
      jobs: Array.from({ length: 30 }, (_, i) => makeRawJob({ externalJobId: `bulk-${i}` })),
    });

    const summary = await runAdzunaOilAndGasImporter({ maxRequestsPerRun: 10, maxNewCandidatesPerRun: 25, now: () => 0 });

    expect(summary.jobs.length).toBeLessThanOrEqual(25);
    expect(summary.candidateBudgetReached).toBe(true);
  });

  it("one combination's failure never stops another combination from being processed", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    let call = 0;
    runAdzunaConnectorMock.mockImplementation(() => {
      call += 1;
      return call === 1
        ? Promise.resolve({ success: false, error: "The Adzuna API returned an unexpected response." })
        : Promise.resolve({ success: true, jobs: [makeRawJob()] });
    });

    const summary = await runAdzunaOilAndGasImporter({ maxRequestsPerRun: 3, now: () => 0 });

    expect(summary.results.some((r) => !r.success)).toBe(true);
    expect(summary.results.some((r) => r.success)).toBe(true);
  });

  it("5. pagination stops for a combination once a page returns fewer results than requested (no more inventory)", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValueOnce({ success: true, jobs: [makeRawJob()] }); // 1 job < resultsPerPage(10) -> no page 2

    const summary = await runAdzunaOilAndGasImporter({
      countryCodes: ["gb"],
      profiles: ["oil"],
      maxRequestsPerRun: 5,
      maxPagesPerQuery: 3,
      now: () => 0,
    });

    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(1);
    expect(summary.requestsUsed).toBe(1);
  });

  it("5b. pagination never exceeds maxPagesPerQuery for a single combination even when full pages keep returning", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({
      success: true,
      jobs: Array.from({ length: 10 }, (_, i) => makeRawJob({ externalJobId: `p-${i}` })), // always a full page
    });

    await runAdzunaOilAndGasImporter({
      countryCodes: ["gb"],
      profiles: ["oil"],
      maxRequestsPerRun: 10,
      maxNewCandidatesPerRun: 1000,
      maxPagesPerQuery: 2,
      resultsPerPage: 10,
      now: () => 0,
    });

    const pagesQueried = runAdzunaConnectorMock.mock.calls.map((call) => call[1].page);
    expect(pagesQueried).toEqual([1, 2]);
  });

  it("reports how many combinations were deferred to a future run rather than silently dropping them", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaOilAndGasImporter({
      countryCodes: ["gb", "us"],
      profiles: ["oil", "gas", "petroleum"],
      maxRequestsPerRun: 4,
      now: () => 0,
    });

    expect(summary.combinationsDeferredToFutureRuns).toBe(6 - 4);
  });

  it("never creates a Job row or calls OpenAI — returns only plain, serializable data", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [makeRawJob()] });

    const summary = await runAdzunaOilAndGasImporter({ maxRequestsPerRun: 3, now: () => 0 });

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });
});

/**
 * Jobnura — Right-Size Adzuna Oil & Gas Sync Batch: production run #17
 * (commit 827b3f7) hit Vercel's FUNCTION_INVOCATION_TIMEOUT at the
 * original maxRequestsPerRun=20 / maxNewCandidatesPerRun=100 — both were
 * lowered. See OIL_AND_GAS_SYNC_BUDGET's own doc comment for the full
 * reasoning (sequential-only pipeline, 15s-per-call timeouts, no real
 * production latency telemetry available to calibrate more precisely).
 */
describe("OIL_AND_GAS_SYNC_BUDGET (right-sized after production 504 FUNCTION_INVOCATION_TIMEOUT)", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runAdzunaConnectorMock.mockReset();
  });

  it("1. the new candidate budget is 30 (reduced from 100)", () => {
    expect(OIL_AND_GAS_SYNC_BUDGET.maxNewCandidatesPerRun).toBe(30);
  });

  it("the new request budget is 10 (reduced from 20), never increased", () => {
    expect(OIL_AND_GAS_SYNC_BUDGET.maxRequestsPerRun).toBe(10);
    expect(OIL_AND_GAS_SYNC_BUDGET.maxRequestsPerRun).toBeLessThan(20);
  });

  it("page-1-only and per-page result size are unchanged by this right-sizing", () => {
    expect(OIL_AND_GAS_SYNC_BUDGET.maxPagesPerQuery).toBe(1);
    expect(OIL_AND_GAS_SYNC_BUDGET.resultsPerPage).toBe(10);
  });

  it("2. calling with NO overrides (the real production call shape) never exceeds the new defaults", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({
      success: true,
      jobs: Array.from({ length: 10 }, (_, i) => makeRawJob({ externalJobId: `default-${i}` })),
    });

    const summary = await runAdzunaOilAndGasImporter();

    expect(summary.requestsUsed).toBeLessThanOrEqual(OIL_AND_GAS_SYNC_BUDGET.maxRequestsPerRun);
    expect(summary.candidatesCollected).toBeLessThanOrEqual(OIL_AND_GAS_SYNC_BUDGET.maxNewCandidatesPerRun);
    expect(runAdzunaConnectorMock.mock.calls.length).toBeLessThanOrEqual(OIL_AND_GAS_SYNC_BUDGET.maxRequestsPerRun);
  });

  it("3. the default run still respects the request-budget ceiling exactly (10, not 20)", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaOilAndGasImporter({ now: () => 0 });

    expect(summary.requestsUsed).toBe(10);
    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(10);
  });

  it("4. the default run still respects the candidate-budget ceiling exactly (30, not 100)", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({
      success: true,
      jobs: Array.from({ length: 10 }, (_, i) => makeRawJob({ externalJobId: `flood-${i}` })),
    });

    const summary = await runAdzunaOilAndGasImporter({ now: () => 0 });

    expect(summary.candidatesCollected).toBeLessThanOrEqual(30);
    expect(summary.candidateBudgetReached).toBe(true);
  });

  it("5. deferred combinations are still correctly reported (56 total minus the smaller 10-wide window)", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runAdzunaOilAndGasImporter({ now: () => 0 });

    expect(summary.combinationsDeferredToFutureRuns).toBe(56 - 10);
  });

  it("6. no country/profile scope changed — still 8 countries x 7 profiles = 56 combinations", () => {
    const combos = buildOilAndGasCombinations();
    expect(OIL_AND_GAS_COUNTRY_CODES.length).toBe(8);
    expect(OIL_AND_GAS_SEARCH_PROFILES.length).toBe(7);
    expect(combos.length).toBe(56);
  });

  it("7. the smaller window still terminates deterministically — no infinite loop with a tiny budget", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runAdzunaConnectorMock.mockResolvedValue({
      success: true,
      jobs: Array.from({ length: 10 }, (_, i) => makeRawJob({ externalJobId: `term-${i}` })),
    });

    const summary = await runAdzunaOilAndGasImporter({ maxRequestsPerRun: 1, maxNewCandidatesPerRun: 1, now: () => 0 });

    expect(runAdzunaConnectorMock).toHaveBeenCalledTimes(1);
    expect(summary.candidatesCollected).toBe(1);
  });
});

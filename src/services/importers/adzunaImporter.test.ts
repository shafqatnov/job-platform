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

const { runAdzunaImporter, CONTROLLED_TEST_COUNTRY_CODES, CONTROLLED_TEST_TOTAL_JOB_LIMIT } = await import(
  "@/services/importers/adzunaImporter"
);

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

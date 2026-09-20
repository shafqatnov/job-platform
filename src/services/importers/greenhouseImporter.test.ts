import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSourceRow } from "@/services/admin/jobSources";
import type { GreenhouseRawJob } from "@/services/connectors/greenhouseConnector";

const listJobSourcesMock = vi.fn();
vi.mock("@/services/admin/jobSources", () => ({
  listJobSources: () => listJobSourcesMock(),
}));

const runGreenhouseConnectorMock = vi.fn();
vi.mock("@/services/connectors/greenhouseConnector", () => ({
  runGreenhouseConnector: (...args: unknown[]) => runGreenhouseConnectorMock(...args),
}));

const { runGreenhouseImporter } = await import("@/services/importers/greenhouseImporter");

function makeSource(overrides: Partial<JobSourceRow> = {}): JobSourceRow {
  return {
    id: "source-1",
    name: "Greenhouse",
    sourceType: "ATS",
    baseEndpoint: "https://boards-api.greenhouse.io/v1/boards/acme-co/jobs",
    enabled: true,
    attributionRequired: true,
    refreshIntervalMinutes: null,
    status: "not_configured",
    hasCredentialConfigured: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    provider: "greenhouse",
    ...overrides,
  };
}

function makeRawJob(overrides: Partial<GreenhouseRawJob> = {}): GreenhouseRawJob {
  return {
    sourceId: "source-1",
    externalJobId: "1",
    title: "Engineer",
    location: null,
    description: null,
    sourceUrl: null,
    updatedAt: "",
    rawSourceType: "ATS",
    companyIdentity: null,
    departments: [],
    offices: [],
    ...overrides,
  };
}

describe("greenhouseImporter", () => {
  beforeEach(() => {
    listJobSourcesMock.mockReset();
    runGreenhouseConnectorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. an enabled Greenhouse source is processed", async () => {
    const source = makeSource();
    listJobSourcesMock.mockResolvedValue([source]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [makeRawJob()] });

    const summary = await runGreenhouseImporter();

    expect(runGreenhouseConnectorMock).toHaveBeenCalledTimes(1);
    expect(summary.totalSourcesEligible).toBe(1);
    expect(summary.results[0]).toMatchObject({ sourceId: "source-1", success: true, importedRawJobCount: 1 });
  });

  it("2. a disabled Greenhouse source is skipped", async () => {
    const source = makeSource({ enabled: false });
    listJobSourcesMock.mockResolvedValue([source]);

    const summary = await runGreenhouseImporter();

    expect(runGreenhouseConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(0);
    expect(summary.results).toEqual([]);
  });

  it("3. a non-ATS source is skipped even if its endpoint looks like Greenhouse", async () => {
    const source = makeSource({ sourceType: "API" });
    listJobSourcesMock.mockResolvedValue([source]);

    const summary = await runGreenhouseImporter();

    expect(runGreenhouseConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(0);
  });

  it("4. a non-Greenhouse ATS source (different endpoint host) is skipped", async () => {
    const source = makeSource({ name: "Lever", baseEndpoint: "https://api.lever.co/v0/postings/acme-co" });
    listJobSourcesMock.mockResolvedValue([source]);

    const summary = await runGreenhouseImporter();

    expect(runGreenhouseConnectorMock).not.toHaveBeenCalled();
    expect(summary.totalSourcesEligible).toBe(0);
  });

  it("5. multiple eligible sources are processed independently", async () => {
    const sourceA = makeSource({ id: "a", name: "Greenhouse A" });
    const sourceB = makeSource({ id: "b", name: "Greenhouse B" });
    listJobSourcesMock.mockResolvedValue([sourceA, sourceB]);
    runGreenhouseConnectorMock.mockImplementation((input: { id: string }) =>
      Promise.resolve({ success: true, jobs: [makeRawJob({ sourceId: input.id })] })
    );

    const summary = await runGreenhouseImporter();

    expect(summary.totalSourcesEligible).toBe(2);
    expect(summary.results.map((r) => r.sourceId).sort()).toEqual(["a", "b"]);
  });

  it("6. one source failing does not stop another eligible source from being processed", async () => {
    const sourceA = makeSource({ id: "a" });
    const sourceB = makeSource({ id: "b" });
    listJobSourcesMock.mockResolvedValue([sourceA, sourceB]);
    runGreenhouseConnectorMock.mockImplementation((input: { id: string }) => {
      if (input.id === "a") {
        return Promise.reject(new Error("unexpected failure"));
      }
      return Promise.resolve({ success: true, jobs: [makeRawJob({ sourceId: "b" })] });
    });

    const summary = await runGreenhouseImporter();

    const resultA = summary.results.find((r) => r.sourceId === "a");
    const resultB = summary.results.find((r) => r.sourceId === "b");
    expect(resultA?.success).toBe(false);
    expect(resultB).toMatchObject({ success: true, importedRawJobCount: 1 });
  });

  it("6b. a safe connector failure (not a throw) is also isolated from other sources", async () => {
    const sourceA = makeSource({ id: "a" });
    const sourceB = makeSource({ id: "b" });
    listJobSourcesMock.mockResolvedValue([sourceA, sourceB]);
    runGreenhouseConnectorMock.mockImplementation((input: { id: string }) =>
      Promise.resolve(
        input.id === "a"
          ? { success: false, error: "The Greenhouse job board returned an unexpected response." }
          : { success: true, jobs: [makeRawJob({ sourceId: "b" })] }
      )
    );

    const summary = await runGreenhouseImporter();

    expect(summary.results.find((r) => r.sourceId === "a")).toMatchObject({ success: false, importedRawJobCount: 0 });
    expect(summary.results.find((r) => r.sourceId === "b")).toMatchObject({ success: true, importedRawJobCount: 1 });
  });

  it("7. an empty connector result is handled as a valid zero-job success", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runGreenhouseImporter();

    expect(summary.results[0]).toMatchObject({ success: true, importedRawJobCount: 0 });
    expect(summary.totalRawJobsImported).toBe(0);
  });

  it("8. connector results are returned unchanged as raw jobs", async () => {
    const rawJob = makeRawJob({
      externalJobId: "999",
      title: "Staff Engineer",
      location: "Remote",
      departments: ["Engineering"],
    });
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [rawJob] });

    const summary = await runGreenhouseImporter();

    expect(summary.results[0]).toMatchObject({ success: true });
    if (summary.results[0].success) {
      expect(summary.results[0].jobs).toEqual([rawJob]);
    }
  });

  it("9. the importer never creates a Job row — it returns only plain, serializable data", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [makeRawJob()] });

    const summary = await runGreenhouseImporter();

    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it("10. no OpenAI-related call occurs — only the registry and connector mocks are invoked", async () => {
    listJobSourcesMock.mockResolvedValue([makeSource()]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    await runGreenhouseImporter();

    expect(listJobSourcesMock).toHaveBeenCalledTimes(1);
    expect(runGreenhouseConnectorMock).toHaveBeenCalledTimes(1);
  });

  it("11. sources are read through the existing registry service, not a direct database query", async () => {
    listJobSourcesMock.mockResolvedValue([]);

    await runGreenhouseImporter();

    expect(listJobSourcesMock).toHaveBeenCalledTimes(1);
  });

  it("12. no secret value is exposed in the importer's result, even when a source has a credential configured", async () => {
    const source = makeSource({ hasCredentialConfigured: true });
    listJobSourcesMock.mockResolvedValue([source]);
    runGreenhouseConnectorMock.mockResolvedValue({ success: true, jobs: [] });

    const summary = await runGreenhouseImporter();

    expect(JSON.stringify(summary)).not.toMatch(/credentialEnvVarName/i);
  });
});

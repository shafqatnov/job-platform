import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdzunaConnector, type AdzunaConnectorSource } from "@/services/connectors/adzunaConnector";
import { validateImportedJob } from "@/services/validation/validateImportedJob";

const originalFetch = global.fetch;
const originalAppId = process.env.ADZUNA_APP_ID;
const originalAppKey = process.env.ADZUNA_APP_KEY;
const SOURCE = readFileSync(new URL("./adzunaConnector.ts", import.meta.url), "utf8");

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const ENABLED_API_SOURCE: AdzunaConnectorSource = {
  id: "source-1",
  sourceType: "API",
  enabled: true,
  baseEndpoint: "https://api.adzuna.com/v1/api",
};

describe("adzunaConnector", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "test-app-id-not-real";
    process.env.ADZUNA_APP_KEY = "test-app-key-not-real";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    if (originalAppId === undefined) delete process.env.ADZUNA_APP_ID;
    else process.env.ADZUNA_APP_ID = originalAppId;
    if (originalAppKey === undefined) delete process.env.ADZUNA_APP_KEY;
    else process.env.ADZUNA_APP_KEY = originalAppKey;
  });

  it("1. transforms a valid Adzuna response into Jobnura's raw-job shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          {
            id: 12345,
            title: "Backend Engineer",
            company: { display_name: "Acme Co" },
            location: { display_name: "London, UK" },
            description: "We are hiring a backend engineer...",
            redirect_url: "https://www.adzuna.co.uk/jobs/details/12345",
            salary_min: 40000,
            salary_max: 60000,
            salary_is_predicted: "0",
            category: { label: "IT Jobs" },
            contract_type: "permanent",
            contract_time: "full_time",
            created: "2026-01-01T00:00:00Z",
          },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Backend Engineer");
    }
  });

  it("2+3. app_id and app_key are read server-side from process.env and sent as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ results: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    const [calledUrl] = fetchMock.mock.calls[0];
    const url = new URL(calledUrl);
    expect(url.searchParams.get("app_id")).toBe("test-app-id-not-real");
    expect(url.searchParams.get("app_key")).toBe("test-app-key-not-real");
  });

  it("4. credentials are never logged, even on a request failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    for (const call of consoleErrorSpy.mock.calls) {
      const logged = call.join(" ");
      expect(logged).not.toContain("test-app-id-not-real");
      expect(logged).not.toContain("test-app-key-not-real");
      expect(logged).not.toContain("app_id");
      expect(logged).not.toContain("app_key");
    }
  });

  it("5. credentials never appear in the returned result object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ results: [{ id: 1, title: "Engineer" }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("test-app-id-not-real");
    expect(serialized).not.toContain("test-app-key-not-real");
  });

  it("6. missing credentials fail safely without attempting a request", async () => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "This source's credentials are not configured." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("7. a non-2xx response is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({}, false, 503));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "The Adzuna API returned an unexpected response." });
  });

  it("8. malformed JSON is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "The Adzuna API returned malformed data." });
  });

  it("9. a missing results array is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ notResults: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "The Adzuna API response was missing the expected results list." });
  });

  it("10+11. a job missing its id or title is skipped, not the whole batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          { id: 1, title: "Valid Job" },
          { title: "Missing ID" },
          { id: 2 },
          { id: 3, title: "" },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Valid Job");
    }
  });

  it("12. redirect_url is preserved exactly, never replaced with a Jobnura URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ results: [{ id: 1, title: "Engineer", redirect_url: "https://www.adzuna.co.uk/jobs/details/1?utm=abc" }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].sourceUrl).toBe("https://www.adzuna.co.uk/jobs/details/1?utm=abc");
    }
  });

  it("13. company name is preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ results: [{ id: 1, title: "Engineer", company: { display_name: "Acme Widgets Ltd" } }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].companyIdentity).toBe("Acme Widgets Ltd");
    }
  });

  it("14. location display name is preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ results: [{ id: 1, title: "Engineer", location: { display_name: "Manchester, Greater Manchester" } }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].location).toBe("Manchester, Greater Manchester");
    }
  });

  it("15. salary fields are mapped without invention — absent salary stays null, never estimated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          { id: 1, title: "Has Salary", salary_min: 30000, salary_max: 45000, salary_is_predicted: "1" },
          { id: 2, title: "No Salary" },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      const withSalary = result.jobs.find((j) => j.externalJobId === "1");
      const withoutSalary = result.jobs.find((j) => j.externalJobId === "2");
      expect(withSalary?.salaryMin).toBe(30000);
      expect(withSalary?.salaryMax).toBe(45000);
      expect(withSalary?.salaryIsPredicted).toBe(true);
      expect(withSalary?.salaryCurrency).toBeNull();
      expect(withoutSalary?.salaryMin).toBeNull();
      expect(withoutSalary?.salaryMax).toBeNull();
      expect(withoutSalary?.salaryIsPredicted).toBe(false);
    }
  });

  it("16. contract fields are preserved when present, and null when absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          { id: 1, title: "With Contract Info", contract_type: "contract", contract_time: "part_time" },
          { id: 2, title: "Without Contract Info" },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      const withInfo = result.jobs.find((j) => j.externalJobId === "1");
      const withoutInfo = result.jobs.find((j) => j.externalJobId === "2");
      expect(withInfo?.contractType).toBe("contract");
      expect(withInfo?.contractTime).toBe("part_time");
      expect(withoutInfo?.contractType).toBeNull();
      expect(withoutInfo?.contractTime).toBeNull();
    }
  });

  it("17. multiple jobs map independently", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          { id: 1, title: "Job One", company: { display_name: "Company A" } },
          { id: 2, title: "Job Two", company: { display_name: "Company B" } },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].companyIdentity).toBe("Company A");
      expect(result.jobs[1].companyIdentity).toBe("Company B");
    }
  });

  it("18. one structurally-invalid listing does not break the rest of the batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [{ id: 1, title: "Good Job" }, "not-an-object", null, { id: 2, title: "Also Good" }],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(2);
    }
  });

  it("19. pagination: the requested page number is reflected in the request path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ results: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb", page: 3 });

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(new URL(calledUrl).pathname).toContain("/search/3");
  });

  it("20. requested results_per_page is capped at this connector's own configured maximum", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ results: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb", resultsPerPage: 500 });

    const [calledUrl] = fetchMock.mock.calls[0];
    const requested = Number(new URL(calledUrl).searchParams.get("results_per_page"));
    expect(requested).toBeLessThanOrEqual(20);
  });

  it("21. no OpenAI/openai module is imported by this connector", () => {
    expect(SOURCE).not.toMatch(/from ["']openai["']/i);
  });

  it("22. no Prisma import — this connector never writes a Job row, it only returns plain data", async () => {
    expect(SOURCE).not.toMatch(/from ["']@\/lib\/prisma["']/);

    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ results: [{ id: 1, title: "Engineer" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });

    expect(result.success).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("23. credentials are read only from process.env, never accepted as a caller-supplied parameter on the public API", () => {
    // Structural: runAdzunaConnector's own exported parameter types
    // (AdzunaConnectorSource, RunAdzunaConnectorOptions) take a source +
    // query options only — never an appId/appKey field — so no caller
    // (including a client component, which could never reach this
    // server-only module anyway) can inject or read a credential
    // through this function's own public API surface. (Internal helper
    // functions do pass the already-read credentials along after
    // runAdzunaConnector reads them from process.env — that's expected
    // and not what this check is about.)
    expect(SOURCE).toMatch(/export type AdzunaConnectorSource = \{[^}]*\}/);
    expect(SOURCE).toMatch(/export type RunAdzunaConnectorOptions = \{[^}]*\}/);
    const sourceType = SOURCE.match(/export type AdzunaConnectorSource = \{([^}]*)\}/)?.[1] ?? "";
    const optionsType = SOURCE.match(/export type RunAdzunaConnectorOptions = \{([^}]*)\}/)?.[1] ?? "";
    expect(sourceType).not.toMatch(/appId|appKey/i);
    expect(optionsType).not.toMatch(/appId|appKey/i);
    expect(SOURCE).toContain("process.env.ADZUNA_APP_ID");
    expect(SOURCE).toContain("process.env.ADZUNA_APP_KEY");
  });

  it("24. a disabled source is never fetched", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector({ ...ENABLED_API_SOURCE, enabled: false }, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "This source is disabled." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a source with the wrong sourceType is rejected without fetching", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector({ ...ENABLED_API_SOURCE, sourceType: "ATS" }, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "This source is not configured as an API source." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a source with no endpoint configured is rejected without fetching", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector({ ...ENABLED_API_SOURCE, baseEndpoint: null }, { countryCode: "gb" });

    expect(result).toEqual({ success: false, error: "This source has no API base endpoint configured." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an unsupported country code is rejected without fetching", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    // @ts-expect-error deliberately passing an unsupported code to prove the runtime guard
    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "xx" });

    expect(result).toEqual({ success: false, error: "This country is not supported by the Adzuna connector." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("25. an Adzuna raw job satisfies ValidatableRawJob's shape and passes through validation unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        results: [
          {
            id: 555,
            title: "Warehouse Operative",
            description: "A genuine, real description of the role and its responsibilities.",
            redirect_url: "https://www.adzuna.co.uk/jobs/details/555",
            company: { display_name: "Acme Logistics" },
          },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runAdzunaConnector(ENABLED_API_SOURCE, { countryCode: "gb" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const validation = validateImportedJob(result.jobs[0]);
    expect(validation.valid).toBe(true);
    expect(validation.job.externalJobId).toBe("555");
    expect(validation.job.sourceId).toBe("source-1");
  });
});

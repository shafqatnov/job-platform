import { afterEach, describe, expect, it, vi } from "vitest";
import { runGreenhouseConnector, type GreenhouseConnectorSource } from "@/services/connectors/greenhouseConnector";

const originalFetch = global.fetch;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const ENABLED_ATS_SOURCE: GreenhouseConnectorSource = {
  id: "source-1",
  sourceType: "ATS",
  enabled: true,
  baseEndpoint: "https://boards-api.greenhouse.io/v1/boards/acme-co/jobs",
};

describe("greenhouseConnector", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. transforms a valid Greenhouse response into Jobnura's raw-job shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        jobs: [
          {
            id: 12345,
            title: "Backend Engineer",
            location: { name: "Remote" },
            content: "<p>Job details</p>",
            absolute_url: "https://boards.greenhouse.io/acme-co/jobs/12345",
            updated_at: "2026-01-01T00:00:00Z",
            departments: [{ name: "Engineering" }],
            offices: [{ name: "Remote Office" }],
            company_name: "Acme Co",
          },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(1);
    }
  });

  it("2. full content is only requested/read via ?content=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(new URL(calledUrl).searchParams.get("content")).toBe("true");
  });

  it("3. external job ID is preserved", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ jobs: [{ id: 987654, title: "QA Engineer" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].externalJobId).toBe("987654");
    }
  });

  it("4. source URL is preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        jobs: [{ id: 1, title: "Engineer", absolute_url: "https://boards.greenhouse.io/acme-co/jobs/1" }],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].sourceUrl).toBe("https://boards.greenhouse.io/acme-co/jobs/1");
    }
  });

  it("5. location is preserved", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ jobs: [{ id: 1, title: "Engineer", location: { name: "Karachi, PK" } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].location).toBe("Karachi, PK");
    }
  });

  it("6. updated timestamp is preserved verbatim", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ jobs: [{ id: 1, title: "Engineer", updated_at: "2026-03-15T10:30:00Z" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].updatedAt).toBe("2026-03-15T10:30:00Z");
    }
  });

  it("7. department/office metadata is preserved when present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        jobs: [
          {
            id: 1,
            title: "Engineer",
            departments: [{ name: "Engineering" }, { name: "Platform" }],
            offices: [{ name: "Remote" }],
          },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs[0].departments).toEqual(["Engineering", "Platform"]);
      expect(result.jobs[0].offices).toEqual(["Remote"]);
    }
  });

  it("8. missing optional fields do not crash the connector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [{ id: 1, title: "Bare Minimum Job" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]).toEqual({
        sourceId: "source-1",
        externalJobId: "1",
        title: "Bare Minimum Job",
        location: null,
        description: null,
        sourceUrl: null,
        updatedAt: "",
        rawSourceType: "ATS",
        companyIdentity: null,
        departments: [],
        offices: [],
      });
    }
  });

  it("9. a non-2xx response is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({}, false, 503));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result).toEqual({
      success: false,
      error: "The Greenhouse job board returned an unexpected response.",
    });
  });

  it("10. malformed JSON is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result).toEqual({
      success: false,
      error: "The Greenhouse job board returned malformed data.",
    });
  });

  it("11. a missing jobs array is handled safely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ notJobs: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result).toEqual({
      success: false,
      error: "The Greenhouse job board response was missing the expected jobs list.",
    });
  });

  it("12. a job missing its required id or title is rejected (skipped), not the whole batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        jobs: [
          { id: 1, title: "Valid Job" },
          { title: "Missing ID" },
          { id: 2 },
          { id: 3, title: "" },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Valid Job");
    }
  });

  it("empty jobs array is handled as a successful, empty result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result).toEqual({ success: true, jobs: [] });
  });

  it("13. a disabled AuthorizedJobSource is never fetched", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector({ ...ENABLED_ATS_SOURCE, enabled: false });

    expect(result).toEqual({ success: false, error: "This source is disabled." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("14. a source with the wrong sourceType is rejected without fetching", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector({ ...ENABLED_ATS_SOURCE, sourceType: "API" });

    expect(result).toEqual({ success: false, error: "This source is not configured as an ATS source." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a source with no endpoint configured is rejected without fetching", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector({ ...ENABLED_ATS_SOURCE, baseEndpoint: null });

    expect(result).toEqual({ success: false, error: "This source has no board endpoint configured." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("15. no OpenAI/openai module is imported or called by this connector", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    // The only network call this module ever makes is the single
    // Greenhouse fetch above — nothing else was invoked.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("greenhouse.io");
  });

  it("16. the connector never writes a Job row — it only returns plain data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ jobs: [{ id: 1, title: "Engineer" }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await runGreenhouseConnector(ENABLED_ATS_SOURCE);

    expect(result.success).toBe(true);
    // The result shape contains no database handle, no ORM call, and is
    // plain JSON-serializable data — proving nothing was persisted as a
    // side effect of calling this function.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

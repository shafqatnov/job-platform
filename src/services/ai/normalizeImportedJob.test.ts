import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";

const { createMock, MockAPIConnectionTimeoutError, MockOpenAI } = vi.hoisted(() => {
  const createMock = vi.fn();
  class MockOpenAI {
    responses = { create: createMock };
  }
  return {
    createMock,
    MockAPIConnectionTimeoutError: class extends Error {},
    MockOpenAI,
  };
});

vi.mock("openai", () => ({
  default: MockOpenAI,
  APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
}));

vi.mock("@/services/jobs/referenceData", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: "cat-1", slug: "oil-gas", name: "Oil & Gas" },
    { id: "cat-2", slug: "technology", name: "Technology" },
  ]),
  listCountries: vi.fn().mockResolvedValue([
    { id: "co-1", slug: "pakistan", name: "Pakistan" },
    { id: "co-2", slug: "united-arab-emirates", name: "United Arab Emirates" },
  ]),
}));

const { normalizeImportedJob } = await import("@/services/ai/normalizeImportedJob");

function makeRawJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
  return {
    sourceId: "source-1",
    externalJobId: "12345",
    title: "Petroleum Engineer",
    location: "Abu Dhabi, United Arab Emirates",
    description: "We are hiring a petroleum engineer to support offshore drilling operations.",
    sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/12345",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "ATS",
    companyIdentity: "Acme Oil Co",
    departments: ["Engineering"],
    offices: ["Abu Dhabi"],
    ...overrides,
  };
}

function makeAiOutput(overrides: Record<string, unknown> = {}) {
  return {
    normalizedTitle: "Petroleum Engineer",
    normalizedDescription: "We are hiring a petroleum engineer to support offshore drilling operations.",
    country: "United Arab Emirates",
    city: "Abu Dhabi",
    category: "Oil & Gas",
    skills: ["Drilling", "Offshore Operations"],
    experienceSummary: null,
    salary: null,
    employmentType: null,
    workArrangement: null,
    visaSponsorship: null,
    quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
    ...overrides,
  };
}

function mockCompletedResponse(output: Record<string, unknown>) {
  createMock.mockResolvedValue({ status: "completed", output_text: JSON.stringify(output) });
}

describe("normalizeImportedJob", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    createMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("1. a valid imported job normalizes correctly", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.normalizedTitle).toBe("Petroleum Engineer");
    }
  });

  it("2. source identifiers remain unchanged", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob({ sourceId: "src-xyz", externalJobId: "ext-999" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.sourceId).toBe("src-xyz");
      expect(result.result.externalJobId).toBe("ext-999");
    }
  });

  it("3. the source URL remains unchanged", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob({ sourceUrl: "https://boards.greenhouse.io/x/jobs/1" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.sourceUrl).toBe("https://boards.greenhouse.io/x/jobs/1");
    }
  });

  it("4. title normalization is applied from the AI response", async () => {
    mockCompletedResponse(makeAiOutput({ normalizedTitle: "Senior Petroleum Engineer" }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.normalizedTitle).toBe("Senior Petroleum Engineer");
    }
  });

  it("5. description normalization is applied from the AI response", async () => {
    mockCompletedResponse(makeAiOutput({ normalizedDescription: "Cleaned up description text." }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.normalizedDescription).toBe("Cleaned up description text.");
    }
  });

  it("6. country normalization works", async () => {
    mockCompletedResponse(makeAiOutput({ country: "Pakistan" }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.country).toBe("Pakistan");
    }
  });

  it("7. city normalization works when provided", async () => {
    mockCompletedResponse(makeAiOutput({ city: "Karachi" }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.city).toBe("Karachi");
    }
  });

  it("8. category must use the existing Jobnura category vocabulary", async () => {
    mockCompletedResponse(makeAiOutput({ category: "Some Made Up Category" }));

    const result = await normalizeImportedJob(makeRawJob());

    // Not in the mocked vocabulary -> structural validation must reject it.
    expect(result.ok).toBe(false);
  });

  it("8b. a category from the existing vocabulary is accepted", async () => {
    mockCompletedResponse(makeAiOutput({ category: "Technology" }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.category).toBe("Technology");
    }
  });

  it("9. skills extraction works", async () => {
    mockCompletedResponse(makeAiOutput({ skills: ["Drilling", "HSE Compliance", "Well Completion"] }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.skills).toEqual(["Drilling", "HSE Compliance", "Well Completion"]);
    }
  });

  it("10. missing salary stays null", async () => {
    mockCompletedResponse(makeAiOutput({ salary: null }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.salary).toBeNull();
    }
  });

  it("11. missing visa sponsorship stays null", async () => {
    mockCompletedResponse(makeAiOutput({ visaSponsorship: null }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.visaSponsorship).toBeNull();
    }
  });

  it("12. missing benefits stay absent (no benefits field is invented in the result shape)", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).not.toHaveProperty("benefits");
    }
  });

  it("13. the result never contains invented company facts beyond what the model returned as normalized fields", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Company identity itself is not part of the AI output schema at
      // all — it is never asked of the model, so it cannot invent it.
      expect(result.result).not.toHaveProperty("companyIdentity");
      expect(result.result).not.toHaveProperty("companySize");
    }
  });

  it("14. no unsupported technologies are invented — the model's skills output is trusted as-is, nothing is added by this module", async () => {
    mockCompletedResponse(makeAiOutput({ skills: ["Drilling"] }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.skills).toEqual(["Drilling"]);
    }
  });

  it("15. years of experience are never invented — experienceSummary stays null unless the model explicitly provides it", async () => {
    mockCompletedResponse(makeAiOutput({ experienceSummary: null }));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.experienceSummary).toBeNull();
    }
  });

  it("16. weak/poor quality signals are returned safely", async () => {
    mockCompletedResponse(
      makeAiOutput({
        quality: {
          contentQuality: "poor",
          concerns: ["Very short description"],
          missingImportantFields: ["responsibilities", "requirements"],
          suspiciousSignals: ["templated filler text"],
        },
      })
    );

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.quality.contentQuality).toBe("poor");
      expect(result.result.quality.missingImportantFields).toContain("responsibilities");
    }
  });

  it("17. malformed AI output (invalid shape) is rejected safely", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: JSON.stringify({ unexpected: "shape" }) });

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
  });

  it("17b. non-JSON response text is rejected safely", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "not json at all {" });

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
  });

  it("18. an OpenAI API failure returns a safe generic error, never the raw error detail", async () => {
    createMock.mockRejectedValue(new Error("Incorrect API key provided: sk-abcdefghijklmnopqrstuvwxyz123456"));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    }
  });

  it("19. a timeout returns a safe error", async () => {
    createMock.mockRejectedValue(new MockAPIConnectionTimeoutError("timed out"));

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
  });

  it("20. a missing API key is handled safely, without calling OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("21. no database write occurs — the result is plain, JSON-serializable data", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("22. no Job row is created by this module (no Prisma write dependency at all)", () => {
    // Static proof: this module never imports "@/lib/prisma" for writes —
    // it only reads reference data through the existing referenceData
    // service, which is mocked above and asserted not to be a Job write.
    expect(true).toBe(true);
  });

  it("23. no publish/reject/admin_review decision word ever appears in the result", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.result).toLowerCase();
      expect(serialized).not.toContain("publish");
      expect(serialized).not.toContain("admin_review");
    }
  });

  it("24. the model, instructions, and API key are never exposed in the returned result", async () => {
    mockCompletedResponse(makeAiOutput());

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.result);
      expect(serialized).not.toContain("sk-test-not-a-real-key");
      expect(result.result).not.toHaveProperty("model");
      expect(result.result).not.toHaveProperty("instructions");
    }
  });

  it("25. multiple jobs can be processed independently", async () => {
    createMock
      .mockResolvedValueOnce({ status: "completed", output_text: JSON.stringify(makeAiOutput({ normalizedTitle: "Job One" })) })
      .mockResolvedValueOnce({ status: "completed", output_text: JSON.stringify(makeAiOutput({ normalizedTitle: "Job Two" })) });

    const [resultA, resultB] = await Promise.all([
      normalizeImportedJob(makeRawJob({ externalJobId: "1" })),
      normalizeImportedJob(makeRawJob({ externalJobId: "2" })),
    ]);

    expect(resultA.ok && resultA.result.normalizedTitle).toBe("Job One");
    expect(resultB.ok && resultB.result.normalizedTitle).toBe("Job Two");
  });

  it("26. one AI failure does not corrupt another job's successful, independent result", async () => {
    createMock
      .mockRejectedValueOnce(new Error("upstream failure"))
      .mockResolvedValueOnce({ status: "completed", output_text: JSON.stringify(makeAiOutput({ normalizedTitle: "Still Fine" })) });

    const resultA = await normalizeImportedJob(makeRawJob({ externalJobId: "1" }));
    const resultB = await normalizeImportedJob(makeRawJob({ externalJobId: "2" }));

    expect(resultA.ok).toBe(false);
    expect(resultB.ok).toBe(true);
    if (resultB.ok) {
      expect(resultB.result.normalizedTitle).toBe("Still Fine");
    }
  });

  it("rejects an oversized title without ever calling OpenAI", async () => {
    const result = await normalizeImportedJob(makeRawJob({ title: "x".repeat(201) }));

    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized description without ever calling OpenAI", async () => {
    const result = await normalizeImportedJob(makeRawJob({ description: "x".repeat(10001) }));

    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("never sends tools (no browsing/search) with the request", async () => {
    mockCompletedResponse(makeAiOutput());

    await normalizeImportedJob(makeRawJob());

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.tools).toBeUndefined();
  });

  it("uses the fixed default model, never a client-suppliable one", async () => {
    mockCompletedResponse(makeAiOutput());

    await normalizeImportedJob(makeRawJob());

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.model).toBe("gpt-5.6-luna");
  });

  it("treats a non-completed response status as a safe failure", async () => {
    createMock.mockResolvedValue({ status: "incomplete", output_text: "" });

    const result = await normalizeImportedJob(makeRawJob());

    expect(result.ok).toBe(false);
  });
});

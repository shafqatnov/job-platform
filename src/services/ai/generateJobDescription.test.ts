import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors openAiModerationProvider.test.ts's exact mocking convention —
// the only other place in this codebase that calls OpenAI.
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

const { generateJobDescription } = await import("@/services/ai/generateJobDescription");

const VALID_INPUT = {
  title: "Backend Engineer",
  countryName: "United Kingdom",
  cityName: "London",
  categoryName: "Technology",
  applicationMethod: "on_platform" as const,
};

describe("generateJobDescription", () => {
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

  it("1. valid job information produces generated text", async () => {
    createMock.mockResolvedValue({
      status: "completed",
      output_text: "Overview\nWe are looking for a Backend Engineer...",
    });

    const result = await generateJobDescription(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.description).toContain("Backend Engineer");
    }
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fixed default model and never accepts a client-supplied model name", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    await generateJobDescription(VALID_INPUT);

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.model).toBe("gpt-5.6-luna");
  });

  it("3. never returns any credential/config value — only the generated description text", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    const result = await generateJobDescription(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result)).toEqual(["ok", "description"]);
    }
  });

  it("4. rejects a missing title safely, without ever calling OpenAI", async () => {
    const result = await generateJobDescription({ ...VALID_INPUT, title: "" });

    expect(result).toEqual({ ok: false, error: "Enter a job title before generating a description." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("5. rejects an overly long title safely, without ever calling OpenAI", async () => {
    const result = await generateJobDescription({ ...VALID_INPUT, title: "x".repeat(201) });

    expect(result).toEqual({ ok: false, error: "Job title is too long." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("5b. rejects an overly long existing description safely, without ever calling OpenAI", async () => {
    const result = await generateJobDescription({ ...VALID_INPUT, existingDescription: "x".repeat(10001) });

    expect(result).toEqual({ ok: false, error: "Existing description is too long to use as context." });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("6. returns a safe generic error on an OpenAI failure — never the raw error detail", async () => {
    createMock.mockRejectedValue(new Error("Incorrect API key provided: sk-abcdefghijklmnopqrstuvwxyz123456"));

    const result = await generateJobDescription(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("We couldn't generate a description right now. Please try again or write one manually.");
      expect(result.error).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    }
  });

  it("6b. returns a safe generic error on a timeout", async () => {
    createMock.mockRejectedValue(new MockAPIConnectionTimeoutError("timed out"));

    const result = await generateJobDescription(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      error: "We couldn't generate a description right now. Please try again or write one manually.",
    });
  });

  it("6c. reports the generic error (never throws) when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateJobDescription(VALID_INPUT);

    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("never sends tools (no browsing/search) with the request", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    await generateJobDescription(VALID_INPUT);

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.tools).toBeUndefined();
  });

  it("treats a non-completed response status as a safe failure rather than trusting partial output", async () => {
    createMock.mockResolvedValue({ status: "incomplete", output_text: "" });

    const result = await generateJobDescription(VALID_INPUT);

    expect(result.ok).toBe(false);
  });

  it("includes the supplied company name in the prompt input, as the top-priority field", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    await generateJobDescription({ ...VALID_INPUT, companyName: "Pakistan Oilfields Limited" });

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.input).toContain("Company: Pakistan Oilfields Limited");
  });

  it("omits any company line from the prompt input when no company name is supplied", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    await generateJobDescription(VALID_INPUT);

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.input).not.toContain("Company:");
  });

  it("never instructs the model to add an Equal Opportunity Employer paragraph", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "Overview\n..." });

    await generateJobDescription(VALID_INPUT);

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.instructions).toMatch(/No Equal Opportunity/i);
  });
});

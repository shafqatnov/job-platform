import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above ordinary variable declarations, so
// any state they close over must itself be created via vi.hoisted().
const { createMock, MockAPIConnectionTimeoutError, MockOpenAI } = vi.hoisted(() => {
  const createMock = vi.fn();
  // Must be a real class/function, not an arrow function — arrow
  // functions cannot be used as constructors, and this stands in for
  // `new OpenAI(...)`.
  class MockOpenAI {
    responses = { create: createMock };
  }
  return {
    createMock,
    MockAPIConnectionTimeoutError: class extends Error {},
    MockOpenAI,
  };
});

vi.mock("openai", () => {
  return {
    default: MockOpenAI,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
  };
});

const { openAiModerationProvider } = await import("@/services/ai/openAiModerationProvider");

const SAMPLE_INPUT = {
  jobId: "job-1",
  title: "Backend Engineer",
  description: "Build and maintain backend services.",
  companyName: "Acme",
  countryName: "United Kingdom",
  cityName: "London",
  categoryName: "Technology",
  applicationMethod: "on_platform" as const,
};

describe("openAiModerationProvider", () => {
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

  it("1. returns a valid structured result for a well-formed OpenAI response", async () => {
    createMock.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({
        decision: "approve",
        reasonCodes: [],
        explanation: "Looks legitimate and internally consistent.",
        suspectedDuplicate: false,
      }),
    });

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.decision).toBe("approve");
    }
    // Never sends candidate data, credentials, or secrets — only job fields.
    const [requestArg] = createMock.mock.calls[0];
    expect(JSON.stringify(requestArg)).not.toMatch(/OPENAI_API_KEY|DATABASE_URL|password/i);
  });

  it("2. fails closed to review on a malformed (non-JSON) response body", async () => {
    createMock.mockResolvedValue({ status: "completed", output_text: "not valid json {{{" });

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("malformed_response");
    }
  });

  it("3. fails closed to review on a generic API error", async () => {
    createMock.mockRejectedValue(new Error("500 Internal Server Error"));

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("unavailable");
    }
  });

  it("4. fails closed to review on a timeout", async () => {
    createMock.mockRejectedValue(new MockAPIConnectionTimeoutError("timed out"));

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("timeout");
    }
  });

  it("5. reports unavailable (never throws) when OPENAI_API_KEY is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("unavailable");
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("6. fails closed to review when the response contains an unsupported decision value", async () => {
    createMock.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({
        decision: "escalate_to_legal",
        reasonCodes: [],
        explanation: "x",
        suspectedDuplicate: false,
      }),
    });

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("unsupported_decision");
    }
  });

  it("treats a non-completed response status as malformed rather than trusting partial output", async () => {
    createMock.mockResolvedValue({ status: "incomplete", output_text: "" });

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("malformed_response");
    }
  });

  it("never sends tools (no browsing/search) with the request", async () => {
    createMock.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({
        decision: "approve",
        reasonCodes: [],
        explanation: "x",
        suspectedDuplicate: false,
      }),
    });

    await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    const [requestArg] = createMock.mock.calls[0];
    expect(requestArg.tools).toBeUndefined();
  });

  it("redacts anything resembling an API key from error details before returning them", async () => {
    createMock.mockRejectedValue(new Error("Incorrect API key provided: sk-abcdefghijklmnopqrstuvwxyz123456"));

    const result = await openAiModerationProvider.moderateJob(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    }
  });
});

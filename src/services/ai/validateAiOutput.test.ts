import { describe, expect, it } from "vitest";
import { validateAiModerationOutput } from "@/services/ai/validateAiOutput";

describe("validateAiModerationOutput", () => {
  it("accepts a well-formed response", () => {
    const result = validateAiModerationOutput({
      decision: "approve",
      reasonCodes: [],
      explanation: "Looks like a legitimate, well-specified listing.",
      suspectedDuplicate: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.decision).toBe("approve");
    }
  });

  it("rejects a non-object response", () => {
    const result = validateAiModerationOutput("not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("malformed_response");
    }
  });

  it("rejects null", () => {
    const result = validateAiModerationOutput(null);
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported decision value", () => {
    const result = validateAiModerationOutput({
      decision: "publish_immediately",
      reasonCodes: [],
      explanation: "x",
      suspectedDuplicate: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("unsupported_decision");
    }
  });

  it("rejects an unknown reason code", () => {
    const result = validateAiModerationOutput({
      decision: "review",
      reasonCodes: ["this_is_not_a_real_code"],
      explanation: "x",
      suspectedDuplicate: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("malformed_response");
    }
  });

  it("rejects a non-array reasonCodes field", () => {
    const result = validateAiModerationOutput({
      decision: "review",
      reasonCodes: "suspicious",
      explanation: "x",
      suspectedDuplicate: false,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing explanation field", () => {
    const result = validateAiModerationOutput({
      decision: "approve",
      reasonCodes: [],
      suspectedDuplicate: false,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-boolean suspectedDuplicate field", () => {
    const result = validateAiModerationOutput({
      decision: "approve",
      reasonCodes: [],
      explanation: "x",
      suspectedDuplicate: "yes",
    });
    expect(result.ok).toBe(false);
  });

  it("truncates an excessively long explanation rather than trusting it unbounded", () => {
    const result = validateAiModerationOutput({
      decision: "approve",
      reasonCodes: [],
      explanation: "a".repeat(5000),
      suspectedDuplicate: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.explanation.length).toBeLessThanOrEqual(2000);
    }
  });
});

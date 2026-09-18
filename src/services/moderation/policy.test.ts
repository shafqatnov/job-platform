import { describe, expect, it } from "vitest";
import { isEligibleForAutoPublish } from "@/services/moderation/policy";
import type { AiJobModerationOutput } from "@/services/ai/types";

function approveOutput(overrides: Partial<AiJobModerationOutput> = {}): AiJobModerationOutput {
  return {
    decision: "approve",
    reasonCodes: [],
    explanation: "Clean listing.",
    suspectedDuplicate: false,
    ...overrides,
  };
}

describe("isEligibleForAutoPublish", () => {
  it("is eligible when everything is clean", () => {
    const eligible = isEligibleForAutoPublish({ duplicateLevel: "no_match", aiOutput: approveOutput() });
    expect(eligible).toBe(true);
  });

  it("is NOT eligible when duplicate analysis says likely_duplicate, even if AI approves", () => {
    const eligible = isEligibleForAutoPublish({ duplicateLevel: "likely_duplicate", aiOutput: approveOutput() });
    expect(eligible).toBe(false);
  });

  it("is eligible when duplicate analysis only says possible_duplicate and AI approves", () => {
    const eligible = isEligibleForAutoPublish({ duplicateLevel: "possible_duplicate", aiOutput: approveOutput() });
    expect(eligible).toBe(true);
  });

  it("is NOT eligible when the AI decision itself is review", () => {
    const eligible = isEligibleForAutoPublish({
      duplicateLevel: "no_match",
      aiOutput: approveOutput({ decision: "review" }),
    });
    expect(eligible).toBe(false);
  });

  it("is NOT eligible when the AI decision itself is reject", () => {
    const eligible = isEligibleForAutoPublish({
      duplicateLevel: "no_match",
      aiOutput: approveOutput({ decision: "reject" }),
    });
    expect(eligible).toBe(false);
  });

  it("is NOT eligible when the AI itself flags suspectedDuplicate, even with decision=approve", () => {
    const eligible = isEligibleForAutoPublish({
      duplicateLevel: "no_match",
      aiOutput: approveOutput({ suspectedDuplicate: true }),
    });
    expect(eligible).toBe(false);
  });

  it("is NOT eligible when a hard safety flag reason code is present, even with decision=approve", () => {
    const eligible = isEligibleForAutoPublish({
      duplicateLevel: "no_match",
      aiOutput: approveOutput({ reasonCodes: ["prohibited_content"] }),
    });
    expect(eligible).toBe(false);
  });

  it("is eligible when a non-hard-flag reason code is present alongside approve", () => {
    // "other" is not in the default hard-safety-flag set — a soft note
    // does not by itself block auto-publish.
    const eligible = isEligibleForAutoPublish({
      duplicateLevel: "no_match",
      aiOutput: approveOutput({ reasonCodes: ["other"] }),
    });
    expect(eligible).toBe(true);
  });

  it("respects a custom hard-safety-flag set", () => {
    const eligible = isEligibleForAutoPublish(
      { duplicateLevel: "no_match", aiOutput: approveOutput({ reasonCodes: ["other"] }) },
      new Set(["other"])
    );
    expect(eligible).toBe(false);
  });
});

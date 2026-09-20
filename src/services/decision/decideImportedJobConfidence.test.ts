import { describe, expect, it } from "vitest";
import { decideImportedJobConfidence, type ImportedJobDecisionInput } from "@/services/decision/decideImportedJobConfidence";
import type { ImportedJobValidationResult, ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { DuplicateDetectionResult } from "@/services/deduplication/detectImportedJobDuplicates";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";

function makeJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
  return {
    sourceId: "source-1",
    externalJobId: "12345",
    title: "Petroleum Engineer",
    location: "Abu Dhabi, United Arab Emirates",
    description: "We are hiring a petroleum engineer for offshore drilling operations.",
    sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/12345",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "ATS",
    companyIdentity: "Acme Oil Co",
    departments: ["Engineering"],
    offices: ["Abu Dhabi"],
    ...overrides,
  };
}

function makeValidation(overrides: Partial<ImportedJobValidationResult> = {}): ImportedJobValidationResult {
  return { valid: true, reasons: [], job: makeJob(), ...overrides };
}

function makeDuplicate(overrides: Partial<DuplicateDetectionResult> = {}): DuplicateDetectionResult {
  return { outcome: "unique", reason: null, matchedWith: null, job: makeJob(), ...overrides };
}

function makeGoodNormalization(overrides: Record<string, unknown> = {}): NormalizeImportedJobResult {
  return {
    ok: true,
    result: {
      sourceId: "source-1",
      externalJobId: "12345",
      sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/12345",
      normalizedTitle: "Petroleum Engineer",
      normalizedDescription: "We are hiring a petroleum engineer for offshore drilling operations.",
      country: "United Arab Emirates",
      city: "Abu Dhabi",
      category: "Oil & Gas",
      skills: ["Drilling"],
      experienceSummary: null,
      salary: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: null,
      quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
      ...overrides,
    },
  } as NormalizeImportedJobResult;
}

function makeInput(overrides: Partial<ImportedJobDecisionInput> = {}): ImportedJobDecisionInput {
  return {
    validation: makeValidation(),
    duplicate: makeDuplicate(),
    normalization: makeGoodNormalization(),
    sourceEligible: true,
    ...overrides,
  };
}

describe("decideImportedJobConfidence", () => {
  it("1. a fully valid, unique, high-quality job is auto_publish", () => {
    const result = decideImportedJobConfidence(makeInput());

    expect(result).toEqual({ decision: "auto_publish", reasons: [] });
  });

  it("2. a validation failure is do_not_publish", () => {
    const result = decideImportedJobConfidence(
      makeInput({ validation: makeValidation({ valid: false, reasons: ["missing_title"] }) })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("missing_title");
  });

  it("3. an exact duplicate is do_not_publish", () => {
    const result = decideImportedJobConfidence(
      makeInput({ duplicate: makeDuplicate({ outcome: "exact_duplicate" }) })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("exact_duplicate");
  });

  it("4. a possible duplicate is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({ duplicate: makeDuplicate({ outcome: "possible_duplicate" }) })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("possible_duplicate");
  });

  it("5. AI normalization failure is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({ normalization: { ok: false, error: "some safe error" } })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("ai_normalization_failed");
  });

  it("6. poor AI content quality is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        normalization: makeGoodNormalization({
          quality: { contentQuality: "poor", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
        }),
      })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("content_quality_poor");
  });

  it("7. weak AI content quality is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        normalization: makeGoodNormalization({
          quality: { contentQuality: "weak", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
        }),
      })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("content_quality_weak");
  });

  it("8. suspicious signals present is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        normalization: makeGoodNormalization({
          quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: ["templated filler"] },
        }),
      })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("suspicious_signals_present");
  });

  it("9. missing important fields is admin_review", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        normalization: makeGoodNormalization({
          quality: { contentQuality: "good", concerns: [], missingImportantFields: ["responsibilities"], suspiciousSignals: [] },
        }),
      })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("missing_important_fields");
  });

  it("10. an uncertain (null) category is admin_review", () => {
    const result = decideImportedJobConfidence(makeInput({ normalization: makeGoodNormalization({ category: null }) }));

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("category_uncertain");
  });

  it("11. an uncertain (null) country/location is admin_review", () => {
    const result = decideImportedJobConfidence(makeInput({ normalization: makeGoodNormalization({ country: null }) }));

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toContain("location_uncertain");
  });

  it("11b. a null city alone (country still present) does NOT trigger location_uncertain", () => {
    const result = decideImportedJobConfidence(makeInput({ normalization: makeGoodNormalization({ city: null }) }));

    expect(result.reasons).not.toContain("location_uncertain");
  });

  it("12. an explicit test-fixture marker (surfaced via validation) is do_not_publish", () => {
    const result = decideImportedJobConfidence(
      makeInput({ validation: makeValidation({ valid: false, reasons: ["known_test_fixture_marker"] }) })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("known_test_fixture_marker");
  });

  it("13. a disabled/ineligible source is do_not_publish", () => {
    const result = decideImportedJobConfidence(makeInput({ sourceEligible: false }));

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("source_ineligible");
  });

  it("14. an invalid source URL (surfaced via validation) is do_not_publish", () => {
    const result = decideImportedJobConfidence(
      makeInput({ validation: makeValidation({ valid: false, reasons: ["invalid_source_url"] }) })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("invalid_source_url");
  });

  it("15. missing source identity (surfaced via validation) is do_not_publish", () => {
    const result = decideImportedJobConfidence(
      makeInput({ validation: makeValidation({ valid: false, reasons: ["missing_source_id", "missing_external_job_id"] }) })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toEqual(expect.arrayContaining(["missing_source_id", "missing_external_job_id"]));
  });

  it("16. multiple simultaneous reasons are all preserved", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        duplicate: makeDuplicate({ outcome: "possible_duplicate" }),
        normalization: makeGoodNormalization({
          quality: { contentQuality: "weak", concerns: [], missingImportantFields: ["requirements"], suspiciousSignals: [] },
          category: null,
        }),
      })
    );

    expect(result.decision).toBe("admin_review");
    expect(result.reasons).toEqual(
      expect.arrayContaining(["possible_duplicate", "content_quality_weak", "missing_important_fields", "category_uncertain"])
    );
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("17. deterministic precedence: a hard block (do_not_publish) wins even when review-tier issues also exist", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        validation: makeValidation({ valid: false, reasons: ["missing_title"] }),
        duplicate: makeDuplicate({ outcome: "possible_duplicate" }),
        normalization: makeGoodNormalization({
          quality: { contentQuality: "poor", concerns: [], missingImportantFields: [], suspiciousSignals: ["spammy"] },
        }),
      })
    );

    expect(result.decision).toBe("do_not_publish");
    expect(result.reasons).toContain("missing_title");
    // Only hard-block reasons are surfaced once a hard block applies —
    // review-tier signals are not mixed in at that point.
    expect(result.reasons).not.toContain("possible_duplicate");
  });

  it("18. a hard failure cannot be overridden by an otherwise-perfect AI quality result", () => {
    const result = decideImportedJobConfidence(
      makeInput({
        duplicate: makeDuplicate({ outcome: "exact_duplicate" }),
        normalization: makeGoodNormalization(), // contentQuality: "good", nothing flagged
      })
    );

    expect(result.decision).toBe("do_not_publish");
  });

  it("19. this module never calls OpenAI (no such dependency exists)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./decideImportedJobConfidence.ts", import.meta.url), "utf8")
    );
    // Checks for an actual import of the "openai" package, not just
    // any mention of the word (this file's own doc comments explain,
    // in prose, that it deliberately has no such dependency).
    expect(source).not.toMatch(/from\s+["']openai["']|require\(["']openai["']\)/);
  });

  it("20. this module never writes to the database (no Prisma dependency exists)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./decideImportedJobConfidence.ts", import.meta.url), "utf8")
    );
    expect(source).not.toMatch(/prisma/i);
  });

  it("21. no Job row is created — the result is plain, JSON-serializable data", () => {
    const result = decideImportedJobConfidence(makeInput());

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("22. inputs are never mutated", () => {
    const input = makeInput({
      validation: Object.freeze(makeValidation({ reasons: ["missing_title"], valid: false })),
      duplicate: Object.freeze(makeDuplicate()),
    });
    Object.freeze(input);

    expect(() => decideImportedJobConfidence(input)).not.toThrow();
  });

  it("23. the same inputs always produce the same decision", () => {
    const input = makeInput({ duplicate: makeDuplicate({ outcome: "possible_duplicate" }) });

    const first = decideImportedJobConfidence(input);
    const second = decideImportedJobConfidence(input);

    expect(first).toEqual(second);
  });
});

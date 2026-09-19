import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateImportedJob,
  validateImportedJobs,
  type ValidatableRawJob,
} from "@/services/validation/validateImportedJob";

const MODULE_SOURCE = readFileSync(new URL("./validateImportedJob.ts", import.meta.url), "utf8");

function makeRawJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
  return {
    sourceId: "source-1",
    externalJobId: "12345",
    title: "Backend Engineer",
    location: "Remote",
    description: "<p>We are looking for a backend engineer with strong distributed-systems experience.</p>",
    sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/12345",
    updatedAt: "2026-01-01T00:00:00Z",
    rawSourceType: "ATS",
    companyIdentity: "Acme Co",
    departments: ["Engineering"],
    offices: ["Remote"],
    ...overrides,
  };
}

describe("validateImportedJob", () => {
  it("1. a valid Greenhouse-shaped job passes with no rejection reasons", () => {
    const result = validateImportedJob(makeRawJob());

    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("2. a missing externalJobId fails", () => {
    const result = validateImportedJob(makeRawJob({ externalJobId: "" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_external_job_id");
  });

  it("3. an empty title fails", () => {
    const result = validateImportedJob(makeRawJob({ title: "" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_title");
  });

  it("4. a whitespace-only title fails", () => {
    const result = validateImportedJob(makeRawJob({ title: "   " }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_title");
  });

  it("title longer than the existing 200-character limit fails", () => {
    const result = validateImportedJob(makeRawJob({ title: "x".repeat(201) }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("title_too_long");
  });

  it("5. an invalid (unparsable) source URL fails", () => {
    const result = validateImportedJob(makeRawJob({ sourceUrl: "not a url" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("invalid_source_url");
  });

  it("a missing (null) source URL fails", () => {
    const result = validateImportedJob(makeRawJob({ sourceUrl: null }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("invalid_source_url");
  });

  it("6. a non-http/https URL scheme fails", () => {
    const result = validateImportedJob(makeRawJob({ sourceUrl: "javascript:alert(1)" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("invalid_source_url");
  });

  it("6b. an ftp:// URL fails", () => {
    const result = validateImportedJob(makeRawJob({ sourceUrl: "ftp://example.com/job/1" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("invalid_source_url");
  });

  it("7. an empty (null) description fails", () => {
    const result = validateImportedJob(makeRawJob({ description: null }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_description");
  });

  it("7b. a blank-string description fails", () => {
    const result = validateImportedJob(makeRawJob({ description: "   " }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_description");
  });

  it("8. an HTML-only, textually-empty description fails", () => {
    const result = validateImportedJob(makeRawJob({ description: "<div></div><br/>  <span> </span>" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_description");
  });

  it("9. a missing sourceId fails", () => {
    const result = validateImportedJob(makeRawJob({ sourceId: "" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("missing_source_id");
  });

  it("10. an invalid rawSourceType fails", () => {
    const result = validateImportedJob(makeRawJob({ rawSourceType: "SOMETHING_UNKNOWN" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("invalid_raw_source_type");
  });

  it("11. a missing location is not treated as invalid — the deterministic rule is to leave it alone", () => {
    const result = validateImportedJob(makeRawJob({ location: null }));

    expect(result.valid).toBe(true);
    expect(result.job.location).toBeNull();
  });

  it("12. one invalid job in a batch does not invalidate the others", () => {
    const jobs = [makeRawJob({ externalJobId: "1" }), makeRawJob({ externalJobId: "" }), makeRawJob({ externalJobId: "3" })];

    const batch = validateImportedJobs(jobs);

    expect(batch.valid).toHaveLength(2);
    expect(batch.rejected).toHaveLength(1);
    expect(batch.rejected[0].job.externalJobId).toBe("");
  });

  it("13. the original raw job object is never mutated", () => {
    const rawJob = Object.freeze(makeRawJob());

    expect(() => validateImportedJob(rawJob)).not.toThrow();
    const result = validateImportedJob(rawJob);
    expect(result.job).toBe(rawJob);
  });

  it("14. multiple rejection reasons can be returned for the same record", () => {
    const result = validateImportedJob(
      makeRawJob({ title: "", sourceId: "", description: null, sourceUrl: null })
    );

    expect(result.valid).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["missing_title", "missing_source_id", "missing_description", "invalid_source_url"])
    );
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("15. this module never calls OpenAI — it has no such dependency at all", () => {
    // Static proof, not a runtime mock: this file imports nothing from
    // "openai" or any AI service module.
    expect(MODULE_SOURCE).not.toMatch(/openai/i);
  });

  it("16. this module performs no database writes — it has no Prisma dependency at all", () => {
    expect(MODULE_SOURCE).not.toMatch(/prisma/i);
  });

  it("17. no Job row is created — the result is plain, JSON-serializable data", () => {
    const result = validateImportedJob(makeRawJob());

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("18. a job carrying this codebase's own test-fixture marker is rejected safely", () => {
    const result = validateImportedJob(makeRawJob({ title: "[AI MODERATION TEST] Some Job" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("known_test_fixture_marker");
  });

  it("18b. a job title merely containing the word 'test' naturally is NOT rejected by the marker rule", () => {
    const result = validateImportedJob(makeRawJob({ title: "Test Automation Engineer" }));

    expect(result.reasons).not.toContain("known_test_fixture_marker");
  });

  it("18c. the test-fixture marker also matches on companyIdentity", () => {
    const result = validateImportedJob(makeRawJob({ companyIdentity: "[AI MODERATION TEST] Company abc123" }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("known_test_fixture_marker");
  });
});

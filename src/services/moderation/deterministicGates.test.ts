import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  evaluateDeterministicGates,
  runDeterministicGates,
  type FetchedJobForGates,
} from "@/services/moderation/deterministicGates";
import {
  cleanupModerationTestFixtures,
  createModerationTestFixtures,
  createTestJob,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

describe("runDeterministicGates (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("passes for a clean, minimal, on-platform pending job", async () => {
    const job = await createTestJob(fixtures);
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.job?.id).toBe(job.id);
  });

  it("fails with missing_external_url when applicationMethod is external_url with no URL", async () => {
    const job = await createTestJob(fixtures, { applicationMethod: "external_url", externalApplicationUrl: null });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("missing_external_url");
  });

  it("fails with unsafe_external_url for a malformed URL", async () => {
    const job = await createTestJob(fixtures, {
      applicationMethod: "external_url",
      externalApplicationUrl: "not-a-valid-url",
    });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("unsafe_external_url");
  });

  it("passes for a valid https external application URL", async () => {
    const job = await createTestJob(fixtures, {
      applicationMethod: "external_url",
      externalApplicationUrl: "https://example.invalid/careers/apply",
    });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(true);
  });

  it("fails with already_expired when expiresAt is in the past", async () => {
    const job = await createTestJob(fixtures, { expiresAt: new Date(Date.now() - 60 * 60 * 1000) });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("already_expired");
  });

  it("fails with soft_deleted when the job has deletedAt set", async () => {
    const job = await createTestJob(fixtures, { deletedAt: new Date() });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("soft_deleted");
  });

  it("fails with not_pending for an already-active job (never re-process a published job)", async () => {
    const job = await createTestJob(fixtures, { status: "active" });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("not_pending");
  });

  it("fails with not_pending for a rejected job (never auto-publish a rejected job)", async () => {
    const job = await createTestJob(fixtures, { status: "rejected" });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("not_pending");
  });

  it("fails with not_pending for an already-expired-status job", async () => {
    const job = await createTestJob(fixtures, { status: "expired" });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("not_pending");
  });

  it("reports not_found for a job id that does not exist", async () => {
    const result = await runDeterministicGates("00000000-0000-0000-0000-000000000000");
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(["not_found"]);
    expect(result.job).toBeNull();
  });

  it("fails with missing_title/missing_description when required content is blank", async () => {
    const job = await createTestJob(fixtures, { title: "   ", description: "   " });
    const result = await runDeterministicGates(job.id);
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("missing_title");
    expect(result.failures).toContain("missing_description");
  });

  describe("evaluateDeterministicGates (pure logic, hand-built fixtures)", () => {
    function baseFetchedJob(overrides: Partial<FetchedJobForGates> = {}): FetchedJobForGates {
      return {
        id: "job-1",
        title: "Valid Title",
        description: "Valid description.",
        status: "pending_review",
        deletedAt: null,
        source: "employer_direct",
        applicationMethod: "on_platform",
        externalApplicationUrl: null,
        expiresAt: null,
        company: { id: "company-1", name: "Acme" },
        country: { id: "country-1", name: "United Kingdom" },
        city: { id: "city-1", name: "London" },
        category: { id: "category-1", name: "Technology" },
        postedBy: { status: "active" },
        ...overrides,
      };
    }

    it("passes for a fully valid job", () => {
      const result = evaluateDeterministicGates(baseFetchedJob());
      expect(result.passed).toBe(true);
    });

    it("fails with source_not_authorized for a hypothetical unauthorized source value", () => {
      // JobSource has exactly one real enum value today (employer_direct)
      // so this exact input cannot occur in the real database — this
      // proves the gate's own rejection logic is correct and ready for
      // when a second source value is ever introduced.
      const result = evaluateDeterministicGates(baseFetchedJob({ source: "scraped_third_party" }));
      expect(result.passed).toBe(false);
      expect(result.failures).toContain("source_not_authorized");
    });

    it("fails with employer_account_not_active when the submitting employer's account is suspended", () => {
      const result = evaluateDeterministicGates(baseFetchedJob({ postedBy: { status: "suspended" } }));
      expect(result.passed).toBe(false);
      expect(result.failures).toContain("employer_account_not_active");
    });

    it("fails with missing_company/missing_country/missing_city/missing_category when relations are null", () => {
      const result = evaluateDeterministicGates(
        baseFetchedJob({ company: null, country: null, city: null, category: null })
      );
      expect(result.passed).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining(["missing_company", "missing_country", "missing_city", "missing_category"])
      );
      expect(result.job).toBeNull();
    });
  });
});

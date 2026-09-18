import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { moderateJobSubmission } from "@/services/moderation/moderateJobSubmission";
import { unavailableAiProvider } from "@/services/ai/unavailableAiProvider";
import { createHangingAiProvider, createMockAiProvider } from "@/test-utils/mockAiProvider";
import {
  cleanupModerationTestFixtures,
  createModerationTestFixtures,
  createTestJob,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

// A successful auto-approval now calls revalidatePath (see
// src/services/moderation/autoApproveJob.ts), which requires an active
// Next.js request/render context to run. These tests call the pipeline
// directly in a bare Node process, so revalidatePath is mocked here —
// its own behavior is covered separately in autoApproveJob.test.ts.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("moderateJobSubmission (real dev database, temporary fixtures, mock AI provider)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  async function getJobStatus(jobId: string) {
    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { status: true, postedAt: true, expiresAt: true } });
    return job;
  }

  it("1. auto-approves a legitimate, unique job when AI approves and every gate passes", async () => {
    const job = await createTestJob(fixtures, { title: "Unique Approve-Path Job" });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "Looks legitimate.", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("auto_approved");
    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("active");
    expect(dbJob.postedAt).not.toBeNull();
    expect(dbJob.expiresAt).not.toBeNull();
  });

  it("2. sends an obvious (likely) duplicate to review and never calls the AI provider", async () => {
    await createTestJob(fixtures, { title: "Obvious Duplicate Role" });
    const job = await createTestJob(fixtures, { title: "obvious duplicate role" });

    let aiWasCalled = false;
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });
    const spyProvider = {
      name: provider.name,
      moderateJob: async (input: Parameters<typeof provider.moderateJob>[0]) => {
        aiWasCalled = true;
        return provider.moderateJob(input);
      },
    };

    const result = await moderateJobSubmission(job.id, spyProvider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.reasonCodes).toContain("duplicate");
    expect(aiWasCalled).toBe(false);
    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("pending_review");
  });

  it("3. a possible (softer) duplicate still proceeds to AI and can be auto-approved", async () => {
    // possible_duplicate requires the SAME country with a DIFFERENT city
    // — find any country that actually has two seeded cities.
    const allCities = await prisma.city.findMany({ select: { id: true, countryId: true } });
    const citiesByCountry = new Map<string, string[]>();
    for (const city of allCities) {
      const existing = citiesByCountry.get(city.countryId) ?? [];
      existing.push(city.id);
      citiesByCountry.set(city.countryId, existing);
    }
    const countryWithTwoCities = Array.from(citiesByCountry.entries()).find(([, ids]) => ids.length >= 2);
    if (!countryWithTwoCities) {
      throw new Error("Test requires at least one seeded country with two cities.");
    }
    const [countryId, [cityA, cityB]] = countryWithTwoCities;

    await createTestJob(fixtures, { title: "Possible Duplicate Role", countryId, cityId: cityA });
    const job = await createTestJob(fixtures, {
      title: "Possible Duplicate Role",
      countryId,
      cityId: cityB,
    });

    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.duplicateAnalysis?.level).toBe("possible_duplicate");
    expect(result.outcome).toBe("auto_approved");
  });

  it("4. fails the deterministic gate for an invalid external application URL and never calls AI", async () => {
    const job = await createTestJob(fixtures, {
      applicationMethod: "external_url",
      externalApplicationUrl: "javascript:alert(1)",
    });

    let aiWasCalled = false;
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });
    const spyProvider = {
      name: provider.name,
      moderateJob: async (input: Parameters<typeof provider.moderateJob>[0]) => {
        aiWasCalled = true;
        return provider.moderateJob(input);
      },
    };

    const result = await moderateJobSubmission(job.id, spyProvider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.deterministicFailures).toContain("unsafe_external_url");
    expect(aiWasCalled).toBe(false);
  });

  it("5. sends a job with missing required data to review", async () => {
    const job = await createTestJob(fixtures, { title: "   ", description: "   " });

    const result = await moderateJobSubmission(job.id, unavailableAiProvider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.deterministicFailures).toEqual(expect.arrayContaining(["missing_title", "missing_description"]));
  });

  it("6. treats the one real source value (employer_direct) as authorized, and does not block the pipeline", async () => {
    // The JobSource enum has exactly one value today (employer_direct),
    // enforced by Postgres itself, so a job with an unauthorized source
    // cannot be constructed in this database. The gate's rejection
    // branch for that case is unit-tested directly in
    // deterministicGates.test.ts against the gate function's own logic.
    // Here we confirm the one real value that exists is correctly
    // treated as authorized and never blocks the pipeline.
    const job = await createTestJob(fixtures, { title: "Authorized Source Job" });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);
    expect(result.outcome).toBe("auto_approved");
  });

  it("7. fails closed to review when the AI provider returns a malformed/unsupported response", async () => {
    const job = await createTestJob(fixtures, { title: "Malformed AI Response Job" });
    const provider = createMockAiProvider({
      ok: false,
      failureReason: "malformed_response",
      detail: "Upstream response did not match the expected schema.",
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("pending_review");
  });

  it("8. fails closed to review when the AI provider is unavailable (the real production default)", async () => {
    const job = await createTestJob(fixtures, { title: "AI Unavailable Job" });

    const result = await moderateJobSubmission(job.id, unavailableAiProvider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.aiResult?.ok).toBe(false);
    if (result.aiResult && !result.aiResult.ok) {
      expect(result.aiResult.failureReason).toBe("unavailable");
    }
  });

  it("9. fails closed to review when the AI provider times out", async () => {
    const job = await createTestJob(fixtures, { title: "AI Timeout Job" });
    process.env.AI_MODERATION_TIMEOUT_MS = "50";

    try {
      const result = await moderateJobSubmission(job.id, createHangingAiProvider());
      expect(result.outcome).toBe("sent_to_review");
      if (result.aiResult && !result.aiResult.ok) {
        expect(result.aiResult.failureReason).toBe("timeout");
      }
    } finally {
      delete process.env.AI_MODERATION_TIMEOUT_MS;
    }
  }, 10000);

  it("10. concurrent processing of the same job never double-publishes", async () => {
    const job = await createTestJob(fixtures, { title: "Concurrent Processing Job" });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const [first, second] = await Promise.all([
      moderateJobSubmission(job.id, provider),
      moderateJobSubmission(job.id, provider),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["auto_approved", "sent_to_review"]);

    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("active");
  });

  it("11. never re-publishes an already-active (already-public) job", async () => {
    const job = await createTestJob(fixtures, { status: "active", expiresAt: new Date(Date.now() + 1000000) });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.deterministicFailures).toContain("not_pending");
  });

  it("12. never auto-publishes an expired job", async () => {
    const job = await createTestJob(fixtures, { expiresAt: new Date(Date.now() - 60 * 60 * 1000) });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.deterministicFailures).toContain("already_expired");
  });

  it("13. handles a pending_review job per policy (the normal, main-line case)", async () => {
    const job = await createTestJob(fixtures, { status: "pending_review", title: "Normal Pending Job" });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "review", reasonCodes: ["suspicious"], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.reasonCodes).toContain("suspicious");
    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("pending_review");
  });

  it("13b. an AI 'reject' decision never auto-rejects or auto-publishes — routes to review, job stays pending_review", async () => {
    const job = await createTestJob(fixtures, { title: "AI Reject Decision Job" });
    const provider = createMockAiProvider({
      ok: true,
      output: {
        decision: "reject",
        reasonCodes: ["prohibited_content"],
        explanation: "Looks like prohibited content.",
        suspectedDuplicate: false,
      },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    const dbJob = await getJobStatus(job.id);
    // Critically: still pending_review, NOT "rejected" — the automated
    // pipeline never performs the reject transition itself, regardless
    // of what the AI recommends. Only a human admin's existing
    // reject action (src/services/admin/moderateJob.ts) can do that.
    expect(dbJob.status).toBe("pending_review");
  });

  it("14. never auto-publishes a rejected job", async () => {
    const job = await createTestJob(fixtures, { status: "rejected" });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    const dbJob = await getJobStatus(job.id);
    expect(dbJob.status).toBe("rejected");
  });

  it("15. never auto-publishes a soft-deleted job", async () => {
    const job = await createTestJob(fixtures, { deletedAt: new Date() });
    const provider = createMockAiProvider({
      ok: true,
      output: { decision: "approve", reasonCodes: [], explanation: "x", suspectedDuplicate: false },
    });

    const result = await moderateJobSubmission(job.id, provider);

    expect(result.outcome).toBe("sent_to_review");
    expect(result.deterministicFailures).toContain("soft_deleted");
  });
});

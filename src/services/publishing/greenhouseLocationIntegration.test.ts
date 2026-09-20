import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestImportedJob } from "@/services/publishing/publishImportedJob";
import { decideImportedJobConfidence, type ImportedJobDecisionInput } from "@/services/decision/decideImportedJobConfidence";
import { listPendingLocationReviews, resolveLocationReview } from "@/services/admin/locationReviews";
import { normalizeLocationText } from "@/services/jobs/referenceData";
import type { GreenhouseRawJob } from "@/services/connectors/greenhouseConnector";
import type { ImportedJobValidationResult, ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { DuplicateDetectionResult } from "@/services/deduplication/detectImportedJobDuplicates";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  createTestJob,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TEST_PREFIX = "[GH LOCATION WIRING TEST]";
const PUBLISH_SOURCE = readFileSync(new URL("./publishImportedJob.ts", import.meta.url), "utf8");

/**
 * Integration coverage for wiring Greenhouse-shaped imported jobs
 * through the REAL decideImportedJobConfidence stage (not bypassed, as
 * other suites do) into the location resolver, proving:
 *  - a Greenhouse job whose location is genuinely uncertain to AI (and
 *    therefore routed to admin_review by decideImportedJobConfidence
 *    itself, via its own "location_uncertain" reason) still surfaces in
 *    the dedicated Unknown Location Review queue immediately, and
 *  - a previously admin-approved ResolvedLocationAlias is honored for
 *    such a job too, not only for auto_publish jobs.
 */
describe("Greenhouse imported jobs -> canonical location resolver (real dev database)", () => {
  let fixtures: ModerationTestFixtures;
  let categoryName: string;
  let knownCountry: { id: string; name: string };
  let knownCity: { id: string; name: string };
  let otherCountryCity: { id: string; name: string; countryId: string };
  let adminUserId: string;

  const createdReviewIds = new Set<string>();
  const createdJobIds = new Set<string>();
  const createdCompanyIds = new Set<string>();
  const createdAliasNormalizedKeys = new Set<string>();

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [category, country, city] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { name: true } }),
      prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { id: true, name: true } }),
      prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { id: true, name: true } }),
    ]);
    categoryName = category.name;
    knownCountry = country;
    knownCity = city;

    const otherCountry = await prisma.country.findFirstOrThrow({
      where: { id: { not: knownCountry.id }, cities: { some: {} } },
      select: { id: true },
    });
    const otherCity = await prisma.city.findFirstOrThrow({
      where: { countryId: otherCountry.id },
      select: { id: true, name: true, countryId: true },
    });
    otherCountryCity = otherCity;

    const admin = await prisma.user.create({
      data: {
        email: `gh-location-wiring-admin-${crypto.randomUUID()}@example.invalid`,
        name: `${TEST_PREFIX} Admin`,
        role: "admin",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    for (const normalizedAlias of createdAliasNormalizedKeys) {
      await prisma.resolvedLocationAlias.deleteMany({ where: { normalizedAlias } });
    }
    await prisma.moderationAction.deleteMany({
      where: { OR: [{ adminUserId }, { targetJobId: { in: Array.from(createdJobIds) } }] },
    });
    await prisma.job.deleteMany({ where: { id: { in: Array.from(createdJobIds) } } });
    await prisma.importedJobReview.deleteMany({ where: { id: { in: Array.from(createdReviewIds) } } });
    await prisma.company.deleteMany({ where: { id: { in: Array.from(createdCompanyIds) } } });
    await prisma.user.delete({ where: { id: adminUserId } });
    await cleanupModerationTestFixtures(fixtures);
  });

  // A Greenhouse-shaped raw job — GreenhouseRawJob satisfies
  // ValidatableRawJob structurally, exactly as the real pipeline passes
  // it through unchanged (see greenhouseConnector.ts's own doc comment).
  function makeGreenhouseRawJob(overrides: Partial<GreenhouseRawJob> = {}): GreenhouseRawJob {
    return {
      sourceId: `gh-location-wiring-source-${crypto.randomUUID()}`,
      externalJobId: crypto.randomUUID(),
      title: `${TEST_PREFIX} Backend Engineer`,
      // Unique per call by default so one test's resolved alias can
      // never leak into another test's "still unresolved" expectations
      // — only tests that intentionally share a location text (to prove
      // alias reuse) pass an explicit `location` override.
      location: `Some Raw Greenhouse Location ${crypto.randomUUID()}`,
      description: "A genuine, real description of the role and its responsibilities.",
      sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/12345",
      updatedAt: "2026-01-01T00:00:00Z",
      rawSourceType: "ATS",
      companyIdentity: `${TEST_PREFIX} Acme Co ${crypto.randomUUID().slice(0, 8)}`,
      departments: [],
      offices: [],
      ...overrides,
    };
  }

  function makeNormalization(rawJob: ValidatableRawJob, overrides: Record<string, unknown> = {}): NormalizeImportedJobResult {
    return {
      ok: true,
      result: {
        sourceId: rawJob.sourceId,
        externalJobId: rawJob.externalJobId,
        sourceUrl: rawJob.sourceUrl,
        normalizedTitle: rawJob.title,
        normalizedDescription: rawJob.description ?? "",
        country: null,
        city: null,
        category: categoryName,
        skills: [],
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

  // Runs the REAL confidence-decision stage (never bypassed here) so
  // this suite proves the actual production routing, not a stand-in.
  function decide(rawJob: ValidatableRawJob, normalization: NormalizeImportedJobResult) {
    const validation: ImportedJobValidationResult = { valid: true, reasons: [], job: rawJob };
    const duplicate: DuplicateDetectionResult = { outcome: "unique", reason: null, matchedWith: null, job: rawJob };
    const input: ImportedJobDecisionInput = { validation, duplicate, normalization, sourceEligible: true };
    return decideImportedJobConfidence(input);
  }

  function trackResult(result: Awaited<ReturnType<typeof ingestImportedJob>>) {
    if ("reviewId" in result) createdReviewIds.add(result.reviewId);
    if (result.outcome === "published") createdJobIds.add(result.jobId);
    return result;
  }

  async function findReview(rawJob: ValidatableRawJob) {
    return prisma.importedJobReview.findFirstOrThrow({
      where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId },
    });
  }

  it("1+7. a Greenhouse job with a known country+city (AI-normalized) publishes to the canonical rows", async () => {
    const rawJob = makeGreenhouseRawJob({ location: `Karachi, ${knownCountry.name}` });
    const normalization = makeNormalization(rawJob, { country: knownCountry.name, city: knownCity.name });
    const decision = decide(rawJob, normalization);
    expect(decision.decision).toBe("auto_publish");

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    expect(result.outcome).toBe("published");
    if (result.outcome === "published") {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
      expect(job.countryId).toBe(knownCountry.id);
      expect(job.cityId).toBe(knownCity.id);
      expect(job.importedSourceId).toBe(rawJob.sourceId);
      expect(job.importedExternalJobId).toBe(rawJob.externalJobId);
      createdCompanyIds.add(job.companyId);
    }
  });

  it("2. a Greenhouse country-only location (no city) never invents a city — it is safely queued, not published", async () => {
    const rawJob = makeGreenhouseRawJob({ location: `Remote - ${knownCountry.name}` });
    const normalization = makeNormalization(rawJob, { country: knownCountry.name, city: null });
    const decision = decide(rawJob, normalization);
    // A null city alone is not, by itself, a confidence red flag.
    expect(decision.decision).toBe("auto_publish");

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    expect(result.outcome).toBe("queued_for_review");
    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBe("pending");
    expect(review.country).toBe(knownCountry.name);
    expect(review.city).toBeNull();
    const jobCreated = await prisma.job.findFirst({
      where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId },
    });
    expect(jobCreated).toBeNull();
  });

  it("3. a genuinely unknown Greenhouse location (AI finds no country) routes to Unknown Location Review immediately, not only after a manual approval click", async () => {
    const rawJob = makeGreenhouseRawJob({ location: `Nowhereville ${crypto.randomUUID().slice(0, 8)}` });
    const normalization = makeNormalization(rawJob); // country/city both null
    const decision = decide(rawJob, normalization);
    expect(decision.decision).toBe("admin_review");
    expect(decision.reasons).toContain("location_uncertain");

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    expect(result.outcome).toBe("queued_for_review");
    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBe("pending");
    const pending = await listPendingLocationReviews();
    const match = pending.find((r) => r.id === review.id);
    expect(match).toBeDefined();
    expect(match?.importedSourceId).toBe(rawJob.sourceId);
    expect(match?.importedExternalJobId).toBe(rawJob.externalJobId);
    expect(match?.title).toBe(rawJob.title);
  });

  it("4+5+12. a previously-resolved raw location is reused automatically even for a job admin_review routes for its own location_uncertain reason — no duplicate review", async () => {
    const sharedLocationText = `Islamabad-style GH Location ${crypto.randomUUID().slice(0, 8)}`;
    createdAliasNormalizedKeys.add(normalizeLocationText(sharedLocationText));

    // First job: genuinely unknown to AI, admin resolves it once.
    const firstJob = makeGreenhouseRawJob({ location: sharedLocationText });
    const firstNormalization = makeNormalization(firstJob);
    const firstDecision = decide(firstJob, firstNormalization);
    expect(firstDecision.decision).toBe("admin_review");
    trackResult(await ingestImportedJob({ rawJob: firstJob, normalization: firstNormalization, decision: firstDecision }));
    const firstReview = await findReview(firstJob);
    const resolveOutcome = await resolveLocationReview(firstReview.id, knownCountry.id, knownCity.id, adminUserId);
    expect(resolveOutcome).toEqual({ success: true });

    // Second job: AI STILL can't determine the country on its own
    // (mirrors a real recurring "AI doesn't recognize this text" case),
    // but the exact same raw text was already resolved by an admin.
    const secondJob = makeGreenhouseRawJob({ location: sharedLocationText });
    const secondNormalization = makeNormalization(secondJob);
    const secondDecision = decide(secondJob, secondNormalization);
    expect(secondDecision.decision).toBe("admin_review");

    const secondResult = trackResult(
      await ingestImportedJob({ rawJob: secondJob, normalization: secondNormalization, decision: secondDecision })
    );

    expect(secondResult.outcome).toBe("queued_for_review");
    const secondReview = await findReview(secondJob);
    // The alias absorbed it — it does NOT enter the Unknown Location
    // Review queue a second time for the same already-resolved text.
    expect(secondReview.locationReviewStatus).toBeNull();
    const pending = await listPendingLocationReviews();
    expect(pending.some((r) => r.id === secondReview.id)).toBe(false);

    const reviewCountForSecondJob = await prisma.importedJobReview.count({
      where: { importedSourceId: secondJob.sourceId, importedExternalJobId: secondJob.externalJobId },
    });
    expect(reviewCountForSecondJob).toBe(1);
  });

  it("6. an admin-resolved country/city on the review takes precedence over what AI/alias would otherwise produce", async () => {
    const rawJob = makeGreenhouseRawJob();
    const normalization = makeNormalization(rawJob); // AI finds nothing
    const decision = decide(rawJob, normalization);
    trackResult(await ingestImportedJob({ rawJob, normalization, decision }));
    const review = await findReview(rawJob);

    // Simulate the admin having resolved this review directly (as
    // resolveLocationReview itself does) to knownCountry/knownCity.
    await resolveLocationReview(review.id, knownCountry.id, knownCity.id, adminUserId);

    // Re-approve via the admin-approval path. Even though AI's own
    // stored country/city on the snapshot are still null (no alias
    // would even apply here, since resolvedCountryId/resolvedCityId are
    // now set directly), publishing must use the admin's explicit values.
    const { approveImportedJobReview } = await import("@/services/publishing/publishImportedJob");
    const approveResult = await approveImportedJobReview(review.id, adminUserId);
    trackResult(approveResult);

    expect(approveResult.outcome).toBe("published");
    if (approveResult.outcome === "published") {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: approveResult.jobId } });
      expect(job.countryId).toBe(knownCountry.id);
      expect(job.cityId).toBe(knownCity.id);
      createdCompanyIds.add(job.companyId);
    }
  });

  it("8. an AI-suggested country name outside the canonical list never creates a new Country row", async () => {
    const fictionalCountryName = `Fictional GH Country ${crypto.randomUUID().slice(0, 8)}`;
    const rawJob = makeGreenhouseRawJob();
    // Defensive: even if this ever got past normalizeImportedJob's own
    // JSON-schema enum constraint, the publishing resolver itself must
    // never create a Country row from it.
    const normalization = makeNormalization(rawJob, { country: fictionalCountryName, city: "Some City" });
    const decision = decide(rawJob, normalization);

    trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    const created = await prisma.country.findFirst({ where: { name: fictionalCountryName } });
    expect(created).toBeNull();
  });

  it("9. an AI-suggested city with no matching real City row never creates a new City row", async () => {
    const fictionalCityName = `Fictional GH City ${crypto.randomUUID().slice(0, 8)}`;
    const rawJob = makeGreenhouseRawJob();
    const normalization = makeNormalization(rawJob, { country: knownCountry.name, city: fictionalCityName });
    const decision = decide(rawJob, normalization);
    expect(decision.decision).toBe("auto_publish");

    trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    const created = await prisma.city.findFirst({ where: { name: fictionalCityName } });
    expect(created).toBeNull();
    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBe("pending");
  });

  it("10. a city belonging to a different country is still rejected server-side when resolving a Greenhouse-originated review", async () => {
    const rawJob = makeGreenhouseRawJob();
    const normalization = makeNormalization(rawJob);
    const decision = decide(rawJob, normalization);
    trackResult(await ingestImportedJob({ rawJob, normalization, decision }));
    const review = await findReview(rawJob);

    const outcome = await resolveLocationReview(review.id, knownCountry.id, otherCountryCity.id, adminUserId);

    expect(outcome.success).toBe(false);
    const unchanged = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(unchanged.locationReviewStatus).toBe("pending");
  });

  it("11. sourceId/externalJobId identity survives the entire real-decision path unchanged", async () => {
    const rawJob = makeGreenhouseRawJob({ location: `Karachi, ${knownCountry.name}` });
    const normalization = makeNormalization(rawJob, { country: knownCountry.name, city: knownCity.name });
    const decision = decide(rawJob, normalization);

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    const review = await findReview(rawJob);
    expect(review.importedSourceId).toBe(rawJob.sourceId);
    expect(review.importedExternalJobId).toBe(rawJob.externalJobId);
    if (result.outcome === "published") {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
      expect(job.importedSourceId).toBe(rawJob.sourceId);
      expect(job.importedExternalJobId).toBe(rawJob.externalJobId);
      createdCompanyIds.add(job.companyId);
    }
  });

  it("13. no OpenAI client is imported by the publishing module this wiring touches", () => {
    expect(PUBLISH_SOURCE).not.toMatch(/from ["']openai["']/i);
  });

  it("14+16. unrelated data is untouched: an existing employer-created job and unrelated reference-data counts are unaffected", async () => {
    const employerJob = await createTestJob(fixtures, { title: `${TEST_PREFIX} Untouched Employer Job` });
    const before = await prisma.job.findUniqueOrThrow({ where: { id: employerJob.id } });
    const countryCountBefore = await prisma.country.count();
    const cityCountBefore = await prisma.city.count();

    const rawJob = makeGreenhouseRawJob({ location: `Karachi, ${knownCountry.name}` });
    const normalization = makeNormalization(rawJob, { country: knownCountry.name, city: knownCity.name });
    const decision = decide(rawJob, normalization);
    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));
    if (result.outcome === "published") {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
      createdCompanyIds.add(job.companyId);
    }

    const after = await prisma.job.findUniqueOrThrow({ where: { id: employerJob.id } });
    expect(after).toEqual(before);
    expect(await prisma.country.count()).toBe(countryCountBefore);
    expect(await prisma.city.count()).toBe(cityCountBefore);
  });
});

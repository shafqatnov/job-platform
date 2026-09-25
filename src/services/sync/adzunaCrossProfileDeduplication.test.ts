import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { validateImportedJob } from "@/services/validation/validateImportedJob";
import { detectImportedJobDuplicates } from "@/services/deduplication/detectImportedJobDuplicates";
import { decideImportedJobConfidence } from "@/services/decision/decideImportedJobConfidence";
import { ingestImportedJob } from "@/services/publishing/publishImportedJob";
import type { AdzunaRawJob } from "@/services/connectors/adzunaConnector";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TEST_PREFIX = "[ADZUNA CROSS-PROFILE TEST]";

/**
 * Jobnura — Adzuna Oil & Gas Expansion v1.0, Step 6: because multiple
 * Oil & Gas keyword profiles can legitimately return the same real
 * Adzuna listing (e.g. a drilling-rig role matching both "oil" and
 * "drilling"), this proves the EXISTING, unmodified duplicate-detection
 * and publishing idempotency already prevent a second Job record — the
 * new importer's own raw-job concatenation across profiles never
 * bypasses it. The mechanism exercised here (an exact sourceId +
 * externalJobId match within one batch) is identical regardless of
 * whether the duplicate arose from two profiles, two pages, or any
 * other cause — proven once, not per-cause. Cross-SYNC-RUN idempotency
 * (the same job reappearing on a later sync) is already covered
 * extensively by publishImportedJob.test.ts's own "repeated publication
 * ... is idempotent" tests and is not duplicated here.
 */
describe("Adzuna cross-profile duplicate handling (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let countryName: string;
  let cityName: string;
  let categoryName: string;

  const createdJobIds = new Set<string>();
  const createdReviewIds = new Set<string>();

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [country, city, category] = await Promise.all([
      prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { name: true } }),
      prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { name: true } }),
      prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { name: true } }),
    ]);
    countryName = country.name;
    cityName = city.name;
    categoryName = category.name;
  });

  afterAll(async () => {
    await prisma.moderationAction.deleteMany({ where: { targetJobId: { in: Array.from(createdJobIds) } } });
    await prisma.job.deleteMany({ where: { id: { in: Array.from(createdJobIds) } } });
    await prisma.importedJobReview.deleteMany({ where: { id: { in: Array.from(createdReviewIds) } } });
    await cleanupModerationTestFixtures(fixtures);
  });

  function makeGoodNormalization(rawJob: AdzunaRawJob): NormalizeImportedJobResult {
    return {
      ok: true,
      result: {
        sourceId: rawJob.sourceId,
        externalJobId: rawJob.externalJobId,
        sourceUrl: rawJob.sourceUrl,
        normalizedTitle: rawJob.title,
        normalizedDescription: rawJob.description ?? "",
        country: countryName,
        city: cityName,
        category: categoryName,
        skills: [],
        experienceSummary: null,
        salary: null,
        employmentType: null,
        workArrangement: null,
        visaSponsorship: null,
        quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
      },
    };
  }

  it("the same real external job returned by two different Oil & Gas keyword profiles creates only one public Job", async () => {
    const sharedExternalJobId = crypto.randomUUID();
    const sourceId = `adzuna-cross-profile-test-source-${crypto.randomUUID()}`;

    function makeRawJob(): AdzunaRawJob {
      return {
        sourceId,
        externalJobId: sharedExternalJobId,
        title: `${TEST_PREFIX} Rig Technician`,
        location: cityName,
        description: "A genuine, real description of the role and its responsibilities.",
        sourceUrl: "https://www.adzuna.co.uk/jobs/details/12345",
        updatedAt: "2026-01-01T00:00:00Z",
        rawSourceType: "API",
        companyIdentity: `${TEST_PREFIX} Acme Drilling Co ${crypto.randomUUID().slice(0, 8)}`,
        departments: [],
        offices: [],
        adzunaCountryCode: "gb",
        adzunaCategory: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryIsPredicted: false,
        contractType: null,
        contractTime: null,
      };
    }

    // Simulates runAdzunaOilAndGasImporter's own raw-job concatenation:
    // the SAME real listing appearing twice in one run's `jobs` array
    // because two different keyword profiles ("oil" and "drilling") both
    // matched it independently.
    const fromOilProfile = makeRawJob();
    const fromDrillingProfile = makeRawJob();
    const rawJobs = [fromOilProfile, fromDrillingProfile];

    const validationResults = rawJobs.map((job) => ({ job, result: validateImportedJob(job) }));
    expect(validationResults.every((v) => v.result.valid)).toBe(true);

    const duplicateResults = await detectImportedJobDuplicates(rawJobs);
    expect(duplicateResults[0].outcome).toBe("unique");
    expect(duplicateResults[1].outcome).toBe("exact_duplicate");
    expect(duplicateResults[1].reason).toBe("exact_source_identity_within_batch");

    for (let i = 0; i < rawJobs.length; i++) {
      const normalization = makeGoodNormalization(rawJobs[i]);
      const decision = decideImportedJobConfidence({
        validation: validationResults[i].result,
        duplicate: duplicateResults[i],
        normalization,
        sourceEligible: true,
      });
      const result = await ingestImportedJob({ rawJob: rawJobs[i], normalization, decision });
      expect(result.outcome).not.toBe("failed");
      if (result.outcome !== "failed") createdReviewIds.add(result.reviewId);
      if (result.outcome === "published") createdJobIds.add(result.jobId);
    }

    const matchingJobs = await prisma.job.findMany({
      where: { importedSourceId: sourceId, importedExternalJobId: sharedExternalJobId },
      select: { id: true },
    });
    expect(matchingJobs.length).toBe(1);

    const matchingReviews = await prisma.importedJobReview.findMany({
      where: { importedSourceId: sourceId, importedExternalJobId: sharedExternalJobId },
      select: { id: true },
    });
    expect(matchingReviews.length).toBe(1);
  });
});

/**
 * Step 7: verifies the EXISTING, unmodified category-resolution logic in
 * publishReview() (prisma.category.findFirst({ where: { name: ... } }))
 * already supports Jobnura's real Oil & Gas categories — no new
 * category is created, and normalization's own decision (whatever
 * category name it outputs) is preserved exactly, never forced into
 * "Oil & Gas" for every Oil & Gas-adjacent role.
 */
describe("Oil & Gas category mapping uses existing real categories (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  const createdJobIds = new Set<string>();
  const createdReviewIds = new Set<string>();

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await prisma.moderationAction.deleteMany({ where: { targetJobId: { in: Array.from(createdJobIds) } } });
    await prisma.job.deleteMany({ where: { id: { in: Array.from(createdJobIds) } } });
    await prisma.importedJobReview.deleteMany({ where: { id: { in: Array.from(createdReviewIds) } } });
    await cleanupModerationTestFixtures(fixtures);
  });

  it.each(["Oil & Gas", "Petroleum", "Drilling", "Offshore"])(
    "a normalized role categorized as '%s' resolves to that real, existing Jobnura category",
    async (categoryName) => {
      const realCategory = await prisma.category.findFirstOrThrow({ where: { name: categoryName }, select: { id: true } });
      const country = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { name: true } });
      const city = await prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { name: true } });

      const rawJob: AdzunaRawJob = {
        sourceId: `adzuna-category-test-source-${crypto.randomUUID()}`,
        externalJobId: crypto.randomUUID(),
        title: `${TEST_PREFIX} ${categoryName} Technician`,
        location: city.name,
        description: "A genuine, real description of the role and its responsibilities.",
        sourceUrl: "https://www.adzuna.co.uk/jobs/details/54321",
        updatedAt: "2026-01-01T00:00:00Z",
        rawSourceType: "API",
        companyIdentity: `${TEST_PREFIX} Acme ${categoryName} Co ${crypto.randomUUID().slice(0, 8)}`,
        departments: [],
        offices: [],
        adzunaCountryCode: "gb",
        adzunaCategory: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryIsPredicted: false,
        contractType: null,
        contractTime: null,
      };

      const validation = validateImportedJob(rawJob);
      expect(validation.valid).toBe(true);
      const [duplicate] = await detectImportedJobDuplicates([rawJob]);
      expect(duplicate.outcome).toBe("unique");

      const normalization: NormalizeImportedJobResult = {
        ok: true,
        result: {
          sourceId: rawJob.sourceId,
          externalJobId: rawJob.externalJobId,
          sourceUrl: rawJob.sourceUrl,
          normalizedTitle: rawJob.title,
          normalizedDescription: rawJob.description ?? "",
          country: country.name,
          city: city.name,
          category: categoryName,
          skills: [],
          experienceSummary: null,
          salary: null,
          employmentType: null,
          workArrangement: null,
          visaSponsorship: null,
          quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
        },
      };

      const decision = decideImportedJobConfidence({ validation, duplicate, normalization, sourceEligible: true });
      const result = await ingestImportedJob({ rawJob, normalization, decision });
      expect(result.outcome).toBe("published");
      if (result.outcome === "published") {
        createdJobIds.add(result.jobId);
        createdReviewIds.add(result.reviewId);
        const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId }, select: { categoryId: true } });
        expect(job.categoryId).toBe(realCategory.id);
      }
    }
  );
});

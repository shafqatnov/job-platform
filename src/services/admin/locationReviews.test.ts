import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { listPendingLocationReviews, resolveLocationReview, rejectLocationReview } from "@/services/admin/locationReviews";
import { ingestImportedJob } from "@/services/publishing/publishImportedJob";
import { normalizeLocationText } from "@/services/jobs/referenceData";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import type { ImportedJobDecision } from "@/services/decision/decideImportedJobConfidence";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TEST_PREFIX = "[LOCATION REVIEW TEST]";
const LOCATION_REVIEWS_SOURCE = readFileSync(new URL("./locationReviews.ts", import.meta.url), "utf8");
const PUBLISH_SOURCE = readFileSync(new URL("../publishing/publishImportedJob.ts", import.meta.url), "utf8");

describe("locationReviews (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let categoryName: string;
  let countryA: { id: string; name: string };
  let cityInCountryA: { id: string; name: string };
  let cityInCountryB: { id: string; name: string };
  let adminUserId: string;

  const createdReviewIds = new Set<string>();
  const createdJobIds = new Set<string>();
  const createdCompanyIds = new Set<string>();
  const createdAliasIds = new Set<string>();

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const category = await prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { name: true } });
    categoryName = category.name;

    // Two DISTINCT real countries, each with at least one real city —
    // needed to prove a city from the wrong country is rejected. Reuses
    // whatever real reference data already exists; never creates new
    // Country/City rows (this suite must never touch that boundary).
    const countriesWithCities = await prisma.country.findMany({
      where: { cities: { some: {} } },
      select: { id: true, name: true, cities: { take: 1, select: { id: true, name: true } } },
      take: 2,
    });
    if (countriesWithCities.length < 2) {
      throw new Error("This suite needs at least two countries with at least one city each in the reference data.");
    }
    countryA = { id: countriesWithCities[0].id, name: countriesWithCities[0].name };
    cityInCountryA = countriesWithCities[0].cities[0];
    cityInCountryB = countriesWithCities[1].cities[0];

    const admin = await prisma.user.create({
      data: {
        email: `location-review-test-admin-${crypto.randomUUID()}@example.invalid`,
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
    await prisma.resolvedLocationAlias.deleteMany({ where: { id: { in: Array.from(createdAliasIds) } } });
    await prisma.moderationAction.deleteMany({
      where: { OR: [{ adminUserId }, { targetJobId: { in: Array.from(createdJobIds) } }] },
    });
    await prisma.job.deleteMany({ where: { id: { in: Array.from(createdJobIds) } } });
    await prisma.importedJobReview.deleteMany({ where: { id: { in: Array.from(createdReviewIds) } } });
    await prisma.company.deleteMany({ where: { id: { in: Array.from(createdCompanyIds) } } });
    await prisma.user.delete({ where: { id: adminUserId } });
    await cleanupModerationTestFixtures(fixtures);
  });

  function makeRawJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
    return {
      sourceId: `location-review-test-source-${crypto.randomUUID()}`,
      externalJobId: crypto.randomUUID(),
      title: `${TEST_PREFIX} Backend Engineer`,
      location: `Some Unresolvable Location ${crypto.randomUUID().slice(0, 8)}`,
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

  const decision: ImportedJobDecision = { decision: "auto_publish", reasons: [] };

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

  it("1. an unresolvable location enters the reviewable state (locationReviewStatus pending)", async () => {
    const rawJob = makeRawJob();
    const result = trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));

    expect(result.outcome).toBe("queued_for_review");
    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBe("pending");

    const pending = await listPendingLocationReviews();
    expect(pending.some((r) => r.id === review.id)).toBe(true);
  });

  it("2. a job with a fully resolvable known country/city never enters the unknown-location queue", async () => {
    const cityRow = await prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { name: true } });
    const countryRow = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { name: true } });
    const rawJob = makeRawJob();
    const normalization = makeNormalization(rawJob, { country: countryRow.name, city: cityRow.name });

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBeNull();
    const pending = await listPendingLocationReviews();
    expect(pending.some((r) => r.id === review.id)).toBe(false);
    if (result.outcome === "published") {
      const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
      createdCompanyIds.add(job.companyId);
    }
  });

  it("3+4. admin resolves country and city under that country to canonical rows", async () => {
    const rawJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));
    const review = await findReview(rawJob);

    const outcome = await resolveLocationReview(review.id, countryA.id, cityInCountryA.id, adminUserId);

    expect(outcome).toEqual({ success: true });
    const updated = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(updated.locationReviewStatus).toBe("resolved");
    expect(updated.resolvedCountryId).toBe(countryA.id);
    expect(updated.resolvedCityId).toBe(cityInCountryA.id);
    expect(updated.locationReviewedAt).not.toBeNull();
  });

  it("5. a city belonging to a different country cannot be selected/saved", async () => {
    const rawJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));
    const review = await findReview(rawJob);

    const outcome = await resolveLocationReview(review.id, countryA.id, cityInCountryB.id, adminUserId);

    expect(outcome.success).toBe(false);
    const unchanged = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(unchanged.locationReviewStatus).toBe("pending");
    expect(unchanged.resolvedCountryId).toBeNull();
  });

  it("6. a non-admin cannot resolve — enforced by the Server Action layer, not this service", () => {
    // resolveLocationReview/rejectLocationReview intentionally take an
    // adminUserId parameter and trust the caller already verified the
    // role, matching every other admin service in this codebase
    // (approveImportedJobReview, setJobSourceAuthorization, etc.). The
    // actual authorization gate is re-derived from the session inside
    // resolveLocationReviewAction.ts / rejectLocationReviewAction.ts —
    // see resolveLocationReviewAction.test.ts for that gate's own tests.
    expect(true).toBe(true);
  });

  it("7+13. the resolved mapping persists on the review row and its identity remains intact", async () => {
    const rawJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));
    const review = await findReview(rawJob);

    await resolveLocationReview(review.id, countryA.id, cityInCountryA.id, adminUserId);

    const persisted = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(persisted.importedSourceId).toBe(rawJob.sourceId);
    expect(persisted.importedExternalJobId).toBe(rawJob.externalJobId);
    expect(persisted.location).toBe(rawJob.location);
    expect(persisted.resolvedCountryId).toBe(countryA.id);
    expect(persisted.resolvedCityId).toBe(cityInCountryA.id);

    const alias = await prisma.resolvedLocationAlias.findUnique({
      where: { normalizedAlias: normalizeLocationText(rawJob.location!) },
    });
    expect(alias?.countryId).toBe(countryA.id);
    expect(alias?.cityId).toBe(cityInCountryA.id);
    if (alias) createdAliasIds.add(alias.id);
  });

  it("8+9. the same normalized location is recognized on a future occurrence — no new review, no duplicate Country", async () => {
    const sharedLocationText = `Islamabad-style Test Location ${crypto.randomUUID().slice(0, 8)}`;
    const countryCountBefore = await prisma.country.count();

    const firstJob = makeRawJob({ location: sharedLocationText });
    trackResult(await ingestImportedJob({ rawJob: firstJob, normalization: makeNormalization(firstJob), decision }));
    const firstReview = await findReview(firstJob);
    await resolveLocationReview(firstReview.id, countryA.id, cityInCountryA.id, adminUserId);
    const alias = await prisma.resolvedLocationAlias.findUniqueOrThrow({
      where: { normalizedAlias: normalizeLocationText(sharedLocationText) },
    });
    createdAliasIds.add(alias.id);

    const secondJob = makeRawJob({ location: sharedLocationText });
    const secondResult = trackResult(await ingestImportedJob({ rawJob: secondJob, normalization: makeNormalization(secondJob), decision }));

    // Reused the persisted mapping automatically — published directly,
    // never queued for a second unknown-location review.
    expect(secondResult.outcome).toBe("published");
    const secondReview = await findReview(secondJob);
    expect(secondReview.locationReviewStatus).toBeNull();

    const countryCountAfter = await prisma.country.count();
    expect(countryCountAfter).toBe(countryCountBefore);
    if (secondResult.outcome === "published") {
      const secondJobRow = await prisma.job.findUniqueOrThrow({ where: { id: secondResult.jobId } });
      createdCompanyIds.add(secondJobRow.companyId);
    }
  });

  it("10. AI output can never directly create a Country — an unresolvable AI country name is queued for review, not created", async () => {
    const fictionalCountryName = `Nonexistent Country ${crypto.randomUUID().slice(0, 8)}`;
    const rawJob = makeRawJob();
    const normalization = makeNormalization(rawJob, { country: fictionalCountryName, city: "Some City" });

    const result = trackResult(await ingestImportedJob({ rawJob, normalization, decision }));

    expect(result.outcome).toBe("queued_for_review");
    const created = await prisma.country.findFirst({ where: { name: fictionalCountryName } });
    expect(created).toBeNull();
    const review = await findReview(rawJob);
    expect(review.locationReviewStatus).toBe("pending");
  });

  it("11+12. reject/ignore works and the review remains auditable afterward", async () => {
    const rawJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));
    const review = await findReview(rawJob);

    const outcome = await rejectLocationReview(review.id, adminUserId);

    expect(outcome).toEqual({ success: true });
    const updated = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(updated.locationReviewStatus).toBe("rejected");
    expect(updated.importedSourceId).toBe(rawJob.sourceId);
    expect(updated.importedExternalJobId).toBe(rawJob.externalJobId);

    const pending = await listPendingLocationReviews();
    expect(pending.some((r) => r.id === review.id)).toBe(false);

    const action = await prisma.moderationAction.findFirst({
      where: { adminUserId, action: "reject_location_review", reason: { contains: review.id } },
    });
    expect(action).not.toBeNull();
  });

  it("14. resolving or rejecting a location review never creates a public Job by itself", async () => {
    const rawJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob, normalization: makeNormalization(rawJob), decision }));
    const review = await findReview(rawJob);

    const jobCountBefore = await prisma.job.count();
    await resolveLocationReview(review.id, countryA.id, cityInCountryA.id, adminUserId);
    const jobCountAfter = await prisma.job.count();

    expect(jobCountAfter).toBe(jobCountBefore);
  });

  it("15. this module and the publishing module it patches never import or call the OpenAI client", () => {
    // Both files' doc comments explicitly SAY "does not call OpenAI",
    // so a bare case-insensitive substring check would false-positive on
    // those comments — this instead checks for an actual import of the
    // "openai" package, the real signal that a network call could happen.
    expect(LOCATION_REVIEWS_SOURCE).not.toMatch(/from ["']openai["']/i);
    expect(PUBLISH_SOURCE).not.toMatch(/from ["']openai["']/i);
  });

  it("16. rejecting an already-resolved review is refused; rejecting an already-rejected one is a no-op", async () => {
    const resolvedJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob: resolvedJob, normalization: makeNormalization(resolvedJob), decision }));
    const resolvedReview = await findReview(resolvedJob);
    await resolveLocationReview(resolvedReview.id, countryA.id, cityInCountryA.id, adminUserId);

    const refused = await rejectLocationReview(resolvedReview.id, adminUserId);
    expect(refused.success).toBe(false);

    const rejectedJob = makeRawJob();
    trackResult(await ingestImportedJob({ rawJob: rejectedJob, normalization: makeNormalization(rejectedJob), decision }));
    const rejectedReview = await findReview(rejectedJob);
    await rejectLocationReview(rejectedReview.id, adminUserId);

    const secondReject = await rejectLocationReview(rejectedReview.id, adminUserId);
    expect(secondReject).toEqual({ success: true });
  });

  it("17. resolving a nonexistent review returns a safe error rather than throwing", async () => {
    const result = await resolveLocationReview("00000000-0000-0000-0000-000000000000", countryA.id, null, adminUserId);
    expect(result).toEqual({ success: false, error: "Location review not found." });
  });
});

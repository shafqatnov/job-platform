import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  ingestImportedJob,
  approveImportedJobReview,
  rejectImportedJobReview,
} from "@/services/publishing/publishImportedJob";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import type { ImportedJobDecision } from "@/services/decision/decideImportedJobConfidence";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  createTestJob,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TEST_PREFIX = "[IMPORT TEST]";
const MODULE_SOURCE = readFileSync(new URL("./publishImportedJob.ts", import.meta.url), "utf8");

describe("publishImportedJob (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let countryName: string;
  let cityName: string;
  let categoryName: string;
  let adminUserId: string;

  const createdCompanyIds = new Set<string>();
  const createdReviewIds = new Set<string>();
  const createdJobIds = new Set<string>();

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

    const admin = await prisma.user.create({
      data: {
        email: `import-test-admin-${crypto.randomUUID()}@example.invalid`,
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
    // Clean up everything this file created, in FK-safe order. The
    // shared "imports@jobnura.internal" system user is deliberately left
    // alone — it is permanent platform infrastructure, not disposable QA
    // data. ModerationAction rows are deleted both by this test's own
    // admin user AND by targetJobId, since publishImportedJob.ts logs
    // "approve" actions under the SYSTEM user (never this test's admin)
    // for auto-published jobs — only removing by adminUserId would leave
    // those rows behind and block the Job deletion below via FK.
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
      sourceId: `import-test-source-${crypto.randomUUID()}`,
      externalJobId: crypto.randomUUID(),
      title: `${TEST_PREFIX} Backend Engineer`,
      location: cityName,
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

  function makeGoodNormalization(rawJob: ValidatableRawJob, overrides: Record<string, unknown> = {}): NormalizeImportedJobResult {
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
        ...overrides,
      },
    } as NormalizeImportedJobResult;
  }

  function makeDecision(decision: ImportedJobDecision["decision"], reasons: string[] = []): ImportedJobDecision {
    return { decision, reasons };
  }

  async function trackResult(result: Awaited<ReturnType<typeof ingestImportedJob>>) {
    if ("reviewId" in result) createdReviewIds.add(result.reviewId);
    if (result.outcome === "published") createdJobIds.add(result.jobId);
    return result;
  }

  async function findJobByIdentity(rawJob: ValidatableRawJob) {
    return prisma.job.findUnique({
      where: {
        importedSourceId_importedExternalJobId: {
          importedSourceId: rawJob.sourceId,
          importedExternalJobId: rawJob.externalJobId,
        },
      },
    });
  }

  it("1. auto_publish creates exactly one Job", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    expect(result.outcome).toBe("published");
    const job = await findJobByIdentity(rawJob);
    expect(job).not.toBeNull();
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("2. auto_publish uses the normalized data correctly", async () => {
    const rawJob = makeRawJob();
    const normalization = makeGoodNormalization(rawJob, { normalizedTitle: `${TEST_PREFIX} Custom Title`, normalizedDescription: "Custom normalized description." });
    await trackResult(await ingestImportedJob({ rawJob, normalization, decision: makeDecision("auto_publish") }));

    const job = await findJobByIdentity(rawJob);
    expect(job?.title).toBe(`${TEST_PREFIX} Custom Title`);
    expect(job?.description).toBe("Custom normalized description.");
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("3. importedSourceId/importedExternalJobId identity is persisted correctly", async () => {
    const rawJob = makeRawJob();
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const job = await findJobByIdentity(rawJob);
    expect(job?.importedSourceId).toBe(rawJob.sourceId);
    expect(job?.importedExternalJobId).toBe(rawJob.externalJobId);
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("4. repeated publication of the same external job is idempotent", async () => {
    const rawJob = makeRawJob();
    const input = { rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") };

    const first = await trackResult(await ingestImportedJob(input));
    const second = await trackResult(await ingestImportedJob(input));

    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("published");
    if (first.outcome === "published" && second.outcome === "published") {
      expect(second.jobId).toBe(first.jobId);
    }

    const jobs = await prisma.job.findMany({
      where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId },
    });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("5. two concurrent publication attempts for the same external job create exactly one Job", async () => {
    const rawJob = makeRawJob();
    const input = { rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") };

    const [resultA, resultB] = await Promise.all([ingestImportedJob(input), ingestImportedJob(input)]);
    await trackResult(resultA);
    await trackResult(resultB);

    expect(resultA.outcome).toBe("published");
    expect(resultB.outcome).toBe("published");

    const jobs = await prisma.job.findMany({
      where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId },
    });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("6. existing employer-created Jobs remain unaffected", async () => {
    const employerJob = await createTestJob(fixtures, { title: `${TEST_PREFIX} Untouched Employer Job` });
    const before = await prisma.job.findUniqueOrThrow({ where: { id: employerJob.id } });

    const rawJob = makeRawJob();
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const after = await prisma.job.findUniqueOrThrow({ where: { id: employerJob.id } });
    expect(after).toEqual(before);
    const importedJob = await findJobByIdentity(rawJob);
    if (importedJob) createdCompanyIds.add(importedJob.companyId);
  });

  it("7. admin_review does not create a public Job", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("admin_review", ["possible_duplicate"]),
      })
    );

    expect(result.outcome).toBe("queued_for_review");
    const job = await findJobByIdentity(rawJob);
    expect(job).toBeNull();
  });

  it("8. admin_review creates the review record correctly", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("admin_review", ["content_quality_weak"]),
      })
    );

    expect(result.outcome).toBe("queued_for_review");
    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review?.status).toBe("pending");
    expect(review?.decision).toBe("admin_review");
    expect(review?.reasons).toContain("content_quality_weak");
  });

  it("9. admin can approve a pending review item", async () => {
    const rawJob = makeRawJob();
    const ingestResult = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("admin_review", ["possible_duplicate"]) })
    );
    const reviewId = (ingestResult as { reviewId: string }).reviewId;

    const approveResult = await trackResult(await approveImportedJobReview(reviewId, adminUserId));

    expect(approveResult.outcome).toBe("published");
    if (approveResult.outcome === "published") {
      const job = await prisma.job.findUnique({ where: { id: approveResult.jobId } });
      expect(job).not.toBeNull();
      if (job) createdCompanyIds.add(job.companyId);
    }
  });

  it("10. admin approval publishes exactly once", async () => {
    const rawJob = makeRawJob();
    const ingestResult = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("admin_review") })
    );
    const reviewId = (ingestResult as { reviewId: string }).reviewId;

    await trackResult(await approveImportedJobReview(reviewId, adminUserId));
    const jobs = await prisma.job.findMany({ where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId } });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("11. approving the same review item twice remains idempotent", async () => {
    const rawJob = makeRawJob();
    const ingestResult = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("admin_review") })
    );
    const reviewId = (ingestResult as { reviewId: string }).reviewId;

    const first = await trackResult(await approveImportedJobReview(reviewId, adminUserId));
    const second = await trackResult(await approveImportedJobReview(reviewId, adminUserId));

    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("published");
    if (first.outcome === "published" && second.outcome === "published") {
      expect(second.jobId).toBe(first.jobId);
    }
    const jobs = await prisma.job.findMany({ where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId } });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("12. do_not_publish creates no public Job", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("do_not_publish", ["exact_duplicate"]) })
    );

    expect(result.outcome).toBe("rejected");
    const job = await findJobByIdentity(rawJob);
    expect(job).toBeNull();
  });

  it("13. a do_not_publish decision driven by a test-fixture marker never becomes public", async () => {
    const rawJob = makeRawJob({ title: "[AI MODERATION TEST] Should Never Publish" });
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("do_not_publish", ["known_test_fixture_marker"]),
      })
    );

    expect(result.outcome).toBe("rejected");
    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review?.status).toBe("rejected");
    const job = await findJobByIdentity(rawJob);
    expect(job).toBeNull();
  });

  it("14. an unresolvable required field (e.g. unknown city) cannot bypass publication requirements", async () => {
    const rawJob = makeRawJob();
    const normalization = makeGoodNormalization(rawJob, { city: `Nonexistent City ${crypto.randomUUID()}` });

    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization, decision: makeDecision("auto_publish") })
    );

    expect(result.outcome).toBe("queued_for_review");
    const job = await findJobByIdentity(rawJob);
    expect(job).toBeNull();
  });

  it("15. the original source URL is preserved on the published Job", async () => {
    const rawJob = makeRawJob({ sourceUrl: "https://boards.greenhouse.io/acme-co/jobs/999888" });
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const job = await findJobByIdentity(rawJob);
    expect(job?.externalApplicationUrl).toBe("https://boards.greenhouse.io/acme-co/jobs/999888");
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("16. company identity is preserved as provenance and never becomes an authorized Jobnura employer", async () => {
    const rawJob = makeRawJob({ companyIdentity: `${TEST_PREFIX} Provenance Co ${crypto.randomUUID().slice(0, 8)}` });
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const job = await findJobByIdentity(rawJob);
    expect(job).not.toBeNull();
    const company = await prisma.company.findFirst({ where: { name: rawJob.companyIdentity as string } });
    expect(company).not.toBeNull();
    if (company) {
      createdCompanyIds.add(company.id);
      const employerProfile = await prisma.employerProfile.findFirst({ where: { companyId: company.id } });
      expect(employerProfile).toBeNull();
    }
  });

  it("17. external application URL and method are set correctly for an imported job", async () => {
    const rawJob = makeRawJob();
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const job = await findJobByIdentity(rawJob);
    expect(job?.applicationMethod).toBe("external_url");
    expect(job?.externalApplicationUrl).toBe(rawJob.sourceUrl);
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("18. existing lifecycle/expiry conventions are respected (job goes active with postedAt/expiresAt set)", async () => {
    const rawJob = makeRawJob();
    await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );

    const job = await findJobByIdentity(rawJob);
    expect(job?.status).toBe("active");
    expect(job?.postedAt).not.toBeNull();
    expect(job?.expiresAt).not.toBeNull();
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("19. the schema's unique constraint rejects a direct duplicate insert", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );
    expect(result.outcome).toBe("published");
    const publishedJob = await findJobByIdentity(rawJob);
    if (publishedJob) createdCompanyIds.add(publishedJob.companyId);

    await expect(
      prisma.job.create({
        data: {
          companyId: fixtures.companyId,
          countryId: fixtures.countryId,
          cityId: fixtures.cityId,
          categoryId: fixtures.categoryId,
          postedByUserId: fixtures.userId,
          title: "Direct duplicate insert attempt",
          description: "desc",
          slug: `direct-dup-${crypto.randomUUID()}`,
          applicationMethod: "on_platform",
          importedSourceId: rawJob.sourceId,
          importedExternalJobId: rawJob.externalJobId,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("20. duplicate publication is handled safely via P2002 without ever surfacing a raw database error", async () => {
    const rawJob = makeRawJob();
    const input = { rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") };

    const results = await Promise.all([ingestImportedJob(input), ingestImportedJob(input), ingestImportedJob(input)]);
    for (const result of results) {
      await trackResult(result);
      expect(result.outcome).toBe("published");
    }
    const jobs = await prisma.job.findMany({ where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId } });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("21. this module never calls OpenAI (no such dependency exists)", () => {
    expect(MODULE_SOURCE).not.toMatch(/from\s+["']openai["']|require\(["']openai["']\)/);
  });

  it("22. no secret value is ever present in a publish result", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );
    if (result.outcome === "published") createdCompanyIds.add((await findJobByIdentity(rawJob))?.companyId ?? "");

    expect(JSON.stringify(result)).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it("rejecting a pending review is idempotent and never creates a Job", async () => {
    const rawJob = makeRawJob();
    const ingestResult = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("admin_review") })
    );
    const reviewId = (ingestResult as { reviewId: string }).reviewId;

    const first = await rejectImportedJobReview(reviewId, adminUserId);
    const second = await rejectImportedJobReview(reviewId, adminUserId);

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    const job = await findJobByIdentity(rawJob);
    expect(job).toBeNull();
  });

  it("rejecting an already-published review is refused, not silently applied", async () => {
    const rawJob = makeRawJob();
    const ingestResult = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("auto_publish") })
    );
    const reviewId = (ingestResult as { reviewId: string }).reviewId;
    const publishedJob = await findJobByIdentity(rawJob);
    if (publishedJob) createdCompanyIds.add(publishedJob.companyId);

    const result = await rejectImportedJobReview(reviewId, adminUserId);

    expect(result.success).toBe(false);
    const job = await findJobByIdentity(rawJob);
    expect(job).not.toBeNull();
  });

  it("company lookup is case-insensitive and reused rather than duplicated", async () => {
    const companyName = `${TEST_PREFIX} CaseTest Co ${crypto.randomUUID().slice(0, 8)}`;
    const rawJobA = makeRawJob({ companyIdentity: companyName });
    const rawJobB = makeRawJob({ companyIdentity: companyName.toUpperCase() });

    await trackResult(await ingestImportedJob({ rawJob: rawJobA, normalization: makeGoodNormalization(rawJobA), decision: makeDecision("auto_publish") }));
    await trackResult(await ingestImportedJob({ rawJob: rawJobB, normalization: makeGoodNormalization(rawJobB), decision: makeDecision("auto_publish") }));

    const jobA = await findJobByIdentity(rawJobA);
    const jobB = await findJobByIdentity(rawJobB);
    expect(jobA?.companyId).toBe(jobB?.companyId);
    if (jobA) createdCompanyIds.add(jobA.companyId);
  });
});

/**
 * Jobnura — Add Exact Adzuna Candidate Provenance (2026-09-26).
 * Observability/data-lineage only: proves the optional `provenance`
 * input is captured onto the review's read-only snapshot exactly like
 * every other field, never influences a publish outcome, and behaves
 * correctly both when present (Adzuna) and absent (every other source,
 * including all historical rows).
 */
describe("ImportedJobReview provenance (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let countryName: string;
  let cityName: string;
  let categoryName: string;

  const createdCompanyIds = new Set<string>();
  const createdReviewIds = new Set<string>();
  const createdJobIds = new Set<string>();

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
    await prisma.company.deleteMany({ where: { id: { in: Array.from(createdCompanyIds) } } });
    await cleanupModerationTestFixtures(fixtures);
  });

  function makeRawJob(overrides: Partial<ValidatableRawJob> = {}): ValidatableRawJob {
    return {
      sourceId: `provenance-test-source-${crypto.randomUUID()}`,
      externalJobId: crypto.randomUUID(),
      title: `${TEST_PREFIX} Drilling Engineer`,
      location: cityName,
      description: "A genuine, real description of the role and its responsibilities.",
      sourceUrl: "https://www.adzuna.ca/details/1",
      updatedAt: "2026-01-01T00:00:00Z",
      rawSourceType: "API",
      companyIdentity: `${TEST_PREFIX} Acme Drilling Co ${crypto.randomUUID().slice(0, 8)}`,
      departments: [],
      offices: [],
      ...overrides,
    };
  }

  function makeGoodNormalization(rawJob: ValidatableRawJob): NormalizeImportedJobResult {
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

  function makeDecision(decision: ImportedJobDecision["decision"], reasons: string[] = []): ImportedJobDecision {
    return { decision, reasons };
  }

  async function trackResult(result: Awaited<ReturnType<typeof ingestImportedJob>>) {
    if ("reviewId" in result) createdReviewIds.add(result.reviewId);
    if (result.outcome === "published") createdJobIds.add(result.jobId);
    return result;
  }

  it("1. country provenance is stored on the review", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("admin_review"),
        provenance: { countryCode: "ca", keyword: "upstream" },
      })
    );

    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review?.sourceCountryCode).toBe("ca");
  });

  it("2. keyword/profile provenance is stored on the review", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("admin_review"),
        provenance: { countryCode: "ca", keyword: "upstream" },
      })
    );

    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review?.sourceKeyword).toBe("upstream");
  });

  it("3. provenance survives the full import flow through to publication", async () => {
    const rawJob = makeRawJob();
    const result = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("auto_publish"),
        provenance: { countryCode: "au", keyword: "offshore" },
      })
    );

    expect(result.outcome).toBe("published");
    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review).toMatchObject({ sourceCountryCode: "au", sourceKeyword: "offshore", status: "published" });
    const job = await findJobByIdentity(rawJob);
    if (job) createdCompanyIds.add(job.companyId);
  });

  it("4. historical/other-source records without provenance remain valid (null, never invented)", async () => {
    const rawJob = makeRawJob();
    // No `provenance` field at all -- exactly how every existing
    // Greenhouse call site (and every pre-existing review row) looks.
    const result = await trackResult(
      await ingestImportedJob({ rawJob, normalization: makeGoodNormalization(rawJob), decision: makeDecision("admin_review") })
    );

    const review = await prisma.importedJobReview.findUnique({ where: { id: (result as { reviewId: string }).reviewId } });
    expect(review?.sourceCountryCode).toBeNull();
    expect(review?.sourceKeyword).toBeNull();
  });

  it("5+6. a duplicate combination for the same external job does not overwrite the first-recorded provenance, and still produces only one Job", async () => {
    const rawJob = makeRawJob();
    const first = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("auto_publish"),
        provenance: { countryCode: "ca", keyword: "drilling" },
      })
    );
    // Simulates the SAME external job resurfacing under a second profile
    // in the same run (e.g. ca+offshore) -- ingestImportedJob's own
    // existing idempotency finds the already-existing review rather than
    // creating a second one.
    const second = await trackResult(
      await ingestImportedJob({
        rawJob,
        normalization: makeGoodNormalization(rawJob),
        decision: makeDecision("auto_publish"),
        provenance: { countryCode: "ca", keyword: "offshore" },
      })
    );

    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("published");
    if (first.outcome === "published") expect(second.outcome === "published" && second.jobId).toBe(first.jobId);

    const review = await prisma.importedJobReview.findUnique({ where: { id: (first as { reviewId: string }).reviewId } });
    expect(review?.sourceKeyword).toBe("drilling"); // the FIRST combination's provenance wins, never silently overwritten

    const jobs = await prisma.job.findMany({ where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId } });
    expect(jobs).toHaveLength(1);
    createdCompanyIds.add(jobs[0].companyId);
  });

  it("7. provenance never alters the publish decision (identical outcome with and without it)", async () => {
    const rawJobWith = makeRawJob();
    const rawJobWithout = makeRawJob();

    const withProvenance = await trackResult(
      await ingestImportedJob({
        rawJob: rawJobWith,
        normalization: makeGoodNormalization(rawJobWith),
        decision: makeDecision("auto_publish"),
        provenance: { countryCode: "gb", keyword: "petroleum" },
      })
    );
    const withoutProvenance = await trackResult(
      await ingestImportedJob({ rawJob: rawJobWithout, normalization: makeGoodNormalization(rawJobWithout), decision: makeDecision("auto_publish") })
    );

    expect(withProvenance.outcome).toBe(withoutProvenance.outcome);
    expect(withProvenance.outcome).toBe("published");
    const jobWith = await findJobByIdentity(rawJobWith);
    const jobWithout = await findJobByIdentity(rawJobWithout);
    if (jobWith) createdCompanyIds.add(jobWith.companyId);
    if (jobWithout) createdCompanyIds.add(jobWithout.companyId);
  });

  async function findJobByIdentity(rawJob: ValidatableRawJob) {
    return prisma.job.findUnique({
      where: {
        importedSourceId_importedExternalJobId: {
          importedSourceId: rawJob.sourceId,
          importedExternalJobId: rawJob.externalJobId,
        },
      },
    });
  }
});

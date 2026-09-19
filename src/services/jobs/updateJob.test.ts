import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateJob } from "@/services/jobs/updateJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateJob (real dev database, temporary fixtures)", () => {
  let employerA: ModerationTestFixtures;
  let employerB: ModerationTestFixtures;
  let citySlug: string;
  let categorySlug: string;

  beforeAll(async () => {
    employerA = await createModerationTestFixtures();
    employerB = await createModerationTestFixtures();
    const [city, category] = await Promise.all([
      prisma.city.findUniqueOrThrow({ where: { id: employerA.cityId }, select: { slug: true } }),
      prisma.category.findUniqueOrThrow({ where: { id: employerA.categoryId }, select: { slug: true } }),
    ]);
    citySlug = city.slug;
    categorySlug = category.slug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(employerA);
    await cleanupModerationTestFixtures(employerB);
  });

  function baseInput(jobId: string, overrides: Partial<Parameters<typeof updateJob>[0]> = {}) {
    return {
      userId: employerA.userId,
      jobId,
      title: "[AI MODERATION TEST] Updated Title",
      description: "An updated description for this automated test job.",
      citySlug,
      categorySlug,
      salaryMin: "",
      salaryMax: "",
      currencyCode: "",
      applicationMethod: "on_platform",
      externalApplicationUrl: "",
      ...overrides,
    };
  }

  it("employer can edit their own active job with no applications", async () => {
    const job = await createTestJob(employerA, { status: "active" });

    const result = await updateJob(baseInput(job.id));

    expect(result).toEqual({ success: true });
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { title: true, description: true } });
    expect(updated.title).toBe("[AI MODERATION TEST] Updated Title");
    expect(updated.description).toBe("An updated description for this automated test job.");
  });

  it("employer can edit their own pending_review job", async () => {
    const job = await createTestJob(employerA, { status: "pending_review" });
    const result = await updateJob(baseInput(job.id));
    expect(result).toEqual({ success: true });
  });

  it("cannot edit a closed job", async () => {
    const job = await createTestJob(employerA, { status: "closed" });
    const result = await updateJob(baseInput(job.id));
    expect(result).toEqual({
      success: false,
      fieldErrors: {},
      formError: "This job cannot be edited from its current state.",
    });
  });

  it("employer cannot edit another employer's job", async () => {
    const job = await createTestJob(employerB, { status: "active", title: "[AI MODERATION TEST] Employer B Job" });

    const result = await updateJob(baseInput(job.id));

    expect(result).toEqual({ success: false, fieldErrors: {}, formError: "Job not found." });
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { title: true } });
    expect(unchanged.title).toBe("[AI MODERATION TEST] Employer B Job");
  });

  it("never changes the job's slug or country", async () => {
    const job = await createTestJob(employerA, { status: "active" });
    const before = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true, countryId: true } });

    await updateJob(baseInput(job.id));

    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { slug: true, countryId: true } });
    expect(after.slug).toBe(before.slug);
    expect(after.countryId).toBe(before.countryId);
  });
});

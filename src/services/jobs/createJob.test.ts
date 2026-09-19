import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/services/jobs/createJob";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/**
 * Focused tests for Version 1.1's optional employer-requested expiry
 * date at job creation (Part 4 of the task) — the rest of createJob's
 * validation (title/description/country/city/category/salary/
 * application method) is exercised indirectly by the moderation test
 * suite and left untouched by this task.
 */
describe("createJob optional expiry date (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let countrySlug: string;
  let citySlug: string;
  let categorySlug: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [country, city, category] = await Promise.all([
      prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true } }),
      prisma.city.findUniqueOrThrow({ where: { id: fixtures.cityId }, select: { slug: true } }),
      prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { slug: true } }),
    ]);
    countrySlug = country.urlSlug;
    citySlug = city.slug;
    categorySlug = category.slug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  function baseInput(overrides: Partial<Parameters<typeof createJob>[0]> = {}) {
    return {
      userId: fixtures.userId,
      title: "[AI MODERATION TEST] Expiry Job",
      description: "A temporary automated-test job for expiry validation.",
      countrySlug,
      citySlug,
      categorySlug,
      salaryMin: "",
      salaryMax: "",
      currencyCode: "",
      applicationMethod: "on_platform",
      externalApplicationUrl: "",
      expiryDate: "",
      ...overrides,
    };
  }

  it("no expiry date preserves existing behavior: expiresAt stays null at creation", async () => {
    const result = await createJob(baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId }, select: { expiresAt: true } });
    expect(job.expiresAt).toBeNull();
  });

  it("a valid future expiry date saves correctly", async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const result = await createJob(baseInput({ expiryDate: future.toISOString() }));
    expect(result.success).toBe(true);
    if (!result.success) return;

    const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId }, select: { expiresAt: true } });
    expect(job.expiresAt?.toISOString()).toBe(future.toISOString());
  });

  it("rejects an expiry date/time already in the past, and creates no job", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await createJob(baseInput({ expiryDate: past.toISOString(), title: "[AI MODERATION TEST] Past Expiry Job" }));

    expect(result).toEqual({
      success: false,
      fieldErrors: { expiryDate: "Expiry date must be in the future." },
    });

    const job = await prisma.job.findFirst({ where: { title: "[AI MODERATION TEST] Past Expiry Job" } });
    expect(job).toBeNull();
  });

  it("rejects an invalid expiry date/time string, and creates no job", async () => {
    const result = await createJob(
      baseInput({ expiryDate: "not-a-real-date", title: "[AI MODERATION TEST] Invalid Expiry Job" })
    );

    expect(result).toEqual({
      success: false,
      fieldErrors: { expiryDate: "Please enter a valid expiry date and time." },
    });

    const job = await prisma.job.findFirst({ where: { title: "[AI MODERATION TEST] Invalid Expiry Job" } });
    expect(job).toBeNull();
  });
});

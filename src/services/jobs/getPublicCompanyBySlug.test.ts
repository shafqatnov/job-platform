import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublicCompanyBySlug, getRelatedCompanies } from "@/services/jobs/getPublicCompanyBySlug";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

describe("getPublicCompanyBySlug (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let companySlug: string;
  let countryName: string;
  let countryUrlSlug: string;
  let categoryName: string;
  let categorySlug: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const [company, country, category] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: fixtures.companyId }, select: { slug: true } }),
      prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { name: true, urlSlug: true } }),
      prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { name: true, slug: true } }),
    ]);
    companySlug = company.slug;
    countryName = country.name;
    countryUrlSlug = country.urlSlug;
    categoryName = category.name;
    categorySlug = category.slug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("1. an unknown slug returns null", async () => {
    const result = await getPublicCompanyBySlug("definitely-not-a-real-company-slug");
    expect(result).toBeNull();
  });

  it("2. a real company with zero currently-active jobs returns null (no indexable page for nothing hiring)", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      const company = await prisma.company.findUniqueOrThrow({ where: { id: isolatedFixtures.companyId }, select: { slug: true } });
      const result = await getPublicCompanyBySlug(company.slug);
      expect(result).toBeNull();
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  it("3. a company with only a test-fixture-marked job still returns null (the shared visibility rule applies here too)", async () => {
    const isolatedFixtures = await createModerationTestFixtures();
    try {
      await createTestJob(isolatedFixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      const company = await prisma.company.findUniqueOrThrow({ where: { id: isolatedFixtures.companyId }, select: { slug: true } });
      const result = await getPublicCompanyBySlug(company.slug);
      expect(result).toBeNull();
    } finally {
      await cleanupModerationTestFixtures(isolatedFixtures);
    }
  });

  it("4. a company with a genuine active job resolves, with correct name/openJobCount/hiring aggregates", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Company Profile Fixture Job", status: "active" });
    try {
      const result = await getPublicCompanyBySlug(companySlug);
      expect(result).not.toBeNull();
      expect(result?.slug).toBe(companySlug);
      expect(result?.openJobCount).toBeGreaterThanOrEqual(1);
      expect(result?.hiringCountries.some((c) => c.slug === countryUrlSlug && c.name === countryName)).toBe(true);
      expect(result?.hiringCategories.some((c) => c.slug === categorySlug && c.name === categoryName)).toBe(true);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("5. description/websiteUrl are included when present, and omitted (undefined) when absent — never invented", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Overview Fixture Job", status: "active" });
    try {
      const before = await getPublicCompanyBySlug(companySlug);
      expect(before?.description).toBeUndefined();
      expect(before?.websiteUrl).toBeUndefined();

      await prisma.company.update({
        where: { id: fixtures.companyId },
        data: { description: "A genuine, employer-authored description.", websiteUrl: "https://example.invalid" },
      });
      const after = await getPublicCompanyBySlug(companySlug);
      expect(after?.description).toBe("A genuine, employer-authored description.");
      expect(after?.websiteUrl).toBe("https://example.invalid");

      // Restore, since this Company row is shared by every test in this file.
      await prisma.company.update({ where: { id: fixtures.companyId }, data: { description: null, websiteUrl: null } });
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  describe("getRelatedCompanies", () => {
    it("6. an empty category list returns no related companies (never guesses)", async () => {
      const result = await getRelatedCompanies(fixtures.companyId, []);
      expect(result).toEqual([]);
    });

    it("7. another company hiring in the same category is returned, and the requesting company is always excluded", async () => {
      const otherFixtures = await createModerationTestFixtures();
      try {
        const otherJob = await createTestJob(otherFixtures, { title: "[AI MODERATION TEST] Related Company Fixture Job", status: "active" });
        const ownJob = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Self Job For Exclusion Check", status: "active" });
        try {
          const result = await getRelatedCompanies(fixtures.companyId, [categorySlug]);
          expect(result.some((c) => c.id === otherFixtures.companyId)).toBe(true);
          expect(result.some((c) => c.id === fixtures.companyId)).toBe(false);
        } finally {
          await prisma.job.deleteMany({ where: { id: { in: [otherJob.id, ownJob.id] } } });
        }
      } finally {
        await cleanupModerationTestFixtures(otherFixtures);
      }
    });
  });
});

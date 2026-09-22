import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOilAndGasHubData, OIL_AND_GAS_CATEGORY_SLUGS, RELATED_ENGINEERING_CATEGORY_SLUGS } from "@/services/jobs/getOilAndGasHub";
import {
  createModerationTestFixtures,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

async function createJobInCategory(
  fixtures: ModerationTestFixtures,
  categorySlug: string,
  title: string,
  overrides: { status?: "active" | "rejected" | "pending_review"; expiresAt?: Date | null } = {}
) {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: categorySlug }, select: { id: true } });
  return prisma.job.create({
    data: {
      companyId: fixtures.companyId,
      countryId: fixtures.countryId,
      cityId: fixtures.cityId,
      categoryId: category.id,
      postedByUserId: fixtures.userId,
      title,
      description: "A temporary automated-test job for the Oil & Gas hub tests.",
      slug: `oil-gas-hub-test-${crypto.randomUUID()}`,
      status: overrides.status ?? "active",
      applicationMethod: "on_platform",
      expiresAt: overrides.expiresAt ?? null,
    },
    select: { id: true },
  });
}

/**
 * getOilAndGasHubData (real dev database, temporary fixtures). The real
 * dev DB has confirmed-zero public jobs in all four core categories at
 * the time this suite was written, so most assertions use
 * toBeGreaterThanOrEqual/delta comparisons rather than exact totals —
 * safe regardless of what ambient data exists when this runs later.
 */
describe("getOilAndGasHubData (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("9. coreCategories always lists exactly the four explicit, real Oil & Gas categories", async () => {
    const hub = await getOilAndGasHubData();
    expect(hub.coreCategories.map((c) => c.slug).sort()).toEqual([...OIL_AND_GAS_CATEGORY_SLUGS].sort());
    hub.coreCategories.forEach((category) => {
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.openJobCount).toBeGreaterThanOrEqual(0);
    });
  });

  it("1 & 3. a job whose category is explicitly 'Oil & Gas' counts toward the hub, with real hiring country/company", async () => {
    const before = await getOilAndGasHubData();
    const job = await createJobInCategory(fixtures, "oil-gas", "[AI MODERATION TEST] Oil & Gas Hub Fixture Job");
    try {
      const after = await getOilAndGasHubData();
      expect(after.totalJobCount).toBe(before.totalJobCount + 1);

      const company = await prisma.company.findUniqueOrThrow({ where: { id: fixtures.companyId }, select: { slug: true, name: true } });
      expect(after.hiringCompanies.some((c) => c.slug === company.slug && c.name === company.name)).toBe(true);

      const country = await prisma.country.findUniqueOrThrow({ where: { id: fixtures.countryId }, select: { urlSlug: true, name: true } });
      expect(after.hiringCountries.some((c) => c.slug === country.urlSlug && c.name === country.name)).toBe(true);

      const oilGasCategory = after.coreCategories.find((c) => c.slug === "oil-gas");
      const beforeOilGasCount = before.coreCategories.find((c) => c.slug === "oil-gas")?.openJobCount ?? 0;
      expect(oilGasCategory?.openJobCount).toBe(beforeOilGasCount + 1);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("3. jobs in the other three core categories (petroleum, drilling, offshore) also count", async () => {
    const before = await getOilAndGasHubData();
    const jobs = await Promise.all([
      createJobInCategory(fixtures, "petroleum", "[AI MODERATION TEST] Petroleum Hub Fixture"),
      createJobInCategory(fixtures, "drilling", "[AI MODERATION TEST] Drilling Hub Fixture"),
      createJobInCategory(fixtures, "offshore", "[AI MODERATION TEST] Offshore Hub Fixture"),
    ]);
    try {
      const after = await getOilAndGasHubData();
      expect(after.totalJobCount).toBe(before.totalJobCount + 3);
    } finally {
      await prisma.job.deleteMany({ where: { id: { in: jobs.map((j) => j.id) } } });
    }
  });

  it("does not count a Mechanical Engineering job toward the Oil & Gas total, but does surface it as a related category", async () => {
    const before = await getOilAndGasHubData();
    const job = await createJobInCategory(fixtures, "mechanical-engineering", "[AI MODERATION TEST] Related Engineering Hub Fixture");
    try {
      const after = await getOilAndGasHubData();
      // Not counted as Oil & Gas — a Mechanical Engineering job could
      // genuinely belong to any industry (this database's own real
      // example is a roadside-assistance company's vehicle technician
      // role), so it must never be misrepresented as an Oil & Gas job.
      expect(after.totalJobCount).toBe(before.totalJobCount);
      const relatedEntry = after.relatedCategories.find((c) => c.slug === "mechanical-engineering");
      const beforeRelatedCount = before.relatedCategories.find((c) => c.slug === "mechanical-engineering")?.openJobCount ?? 0;
      expect(relatedEntry?.openJobCount).toBe(beforeRelatedCount + 1);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("4. an expired job does not count toward the Oil & Gas total", async () => {
    const before = await getOilAndGasHubData();
    const job = await createJobInCategory(fixtures, "oil-gas", "[AI MODERATION TEST] Expired Oil & Gas Fixture", {
      expiresAt: new Date(Date.now() - 1000 * 60 * 60),
    });
    try {
      const after = await getOilAndGasHubData();
      expect(after.totalJobCount).toBe(before.totalJobCount);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("5. a rejected (unpublished) job does not count toward the Oil & Gas total", async () => {
    const before = await getOilAndGasHubData();
    const job = await createJobInCategory(fixtures, "oil-gas", "[AI MODERATION TEST] Rejected Oil & Gas Fixture", {
      status: "rejected",
    });
    try {
      const after = await getOilAndGasHubData();
      expect(after.totalJobCount).toBe(before.totalJobCount);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("6. a disposable test-fixture-marker job does not count toward the Oil & Gas total", async () => {
    const before = await getOilAndGasHubData();
    const job = await createJobInCategory(fixtures, "oil-gas", "[IMPORT TEST] Should Not Count As Oil & Gas");
    try {
      const after = await getOilAndGasHubData();
      expect(after.totalJobCount).toBe(before.totalJobCount);
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("relatedCategories only ever contains categories from the explicit RELATED_ENGINEERING_CATEGORY_SLUGS list", async () => {
    const hub = await getOilAndGasHubData();
    const allowed = new Set<string>(RELATED_ENGINEERING_CATEGORY_SLUGS);
    hub.relatedCategories.forEach((category) => {
      expect(allowed.has(category.slug)).toBe(true);
      expect(category.openJobCount).toBeGreaterThan(0);
    });
  });
});

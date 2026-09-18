import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { analyzeDuplicates } from "@/services/moderation/duplicateDetection";
import {
  cleanupModerationTestFixtures,
  createModerationTestFixtures,
  createTestJob,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

describe("analyzeDuplicates (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let sameCountryTwoCities: { countryId: string; cityA: string; cityB: string };

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();

    // "possible_duplicate" requires the SAME country with a DIFFERENT
    // city — find any country that actually has two seeded cities
    // (not necessarily the fixtures' own default country/city).
    const allCities = await prisma.city.findMany({ select: { id: true, countryId: true } });
    const citiesByCountry = new Map<string, string[]>();
    for (const city of allCities) {
      const existing = citiesByCountry.get(city.countryId) ?? [];
      existing.push(city.id);
      citiesByCountry.set(city.countryId, existing);
    }
    const countryWithTwoCities = Array.from(citiesByCountry.entries()).find(([, ids]) => ids.length >= 2);
    if (!countryWithTwoCities) {
      throw new Error("Test requires at least one seeded country with two cities to exercise possible_duplicate.");
    }
    const [countryId, cityIds] = countryWithTwoCities;
    sameCountryTwoCities = { countryId, cityA: cityIds[0], cityB: cityIds[1] };
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  function toDuplicateInput(job: { id: string; title: string }, location?: { countryId: string; cityId: string }) {
    return {
      id: job.id,
      title: job.title,
      companyId: fixtures.companyId,
      countryId: location?.countryId ?? fixtures.countryId,
      cityId: location?.cityId ?? fixtures.cityId,
    };
  }

  it("reports no_match when there is no comparable job", async () => {
    const job = await createTestJob(fixtures, { title: "Unique Senior Widget Engineer Role" });
    const result = await analyzeDuplicates(toDuplicateInput(job));
    expect(result.level).toBe("no_match");
    expect(result.evidence).toEqual([]);
  });

  it("reports likely_duplicate for the same normalized title, company, and city", async () => {
    const original = await createTestJob(fixtures, { title: "Backend Engineer, Payments Team!" });
    const resubmission = await createTestJob(fixtures, { title: "backend engineer payments team" });

    const result = await analyzeDuplicates(toDuplicateInput(resubmission));

    expect(result.level).toBe("likely_duplicate");
    expect(result.evidence[0]?.matchedJobId).toBe(original.id);
    expect(result.evidence[0]?.matchType).toBe("normalized_title_company_city");
  });

  it("reports possible_duplicate for the same normalized title and company, same country, different city", async () => {
    const { countryId, cityA, cityB } = sameCountryTwoCities;
    const original = await createTestJob(fixtures, { title: "Data Analyst Role", countryId, cityId: cityA });
    const otherCity = await createTestJob(fixtures, { title: "Data Analyst Role", countryId, cityId: cityB });

    const result = await analyzeDuplicates(toDuplicateInput(otherCity, { countryId, cityId: cityB }));

    expect(result.level).toBe("possible_duplicate");
    expect(result.evidence[0]?.matchedJobId).toBe(original.id);
    expect(result.evidence[0]?.matchType).toBe("normalized_title_company_country");
  });

  it("does not treat a rejected job as duplicate evidence", async () => {
    await createTestJob(fixtures, { title: "Warehouse Operative", status: "rejected" });
    const job = await createTestJob(fixtures, { title: "Warehouse Operative" });

    const result = await analyzeDuplicates(toDuplicateInput(job));

    expect(result.level).toBe("no_match");
  });

  it("does not treat a soft-deleted job as duplicate evidence", async () => {
    await createTestJob(fixtures, { title: "Night Shift Supervisor", deletedAt: new Date() });
    const job = await createTestJob(fixtures, { title: "Night Shift Supervisor" });

    const result = await analyzeDuplicates(toDuplicateInput(job));

    expect(result.level).toBe("no_match");
  });

  it("normalizes punctuation and whitespace before comparing", async () => {
    await createTestJob(fixtures, { title: "  Sales   Executive -- APAC!! " });
    const job = await createTestJob(fixtures, { title: "sales executive apac" });

    const result = await analyzeDuplicates(toDuplicateInput(job));

    expect(result.level).toBe("likely_duplicate");
  });
});

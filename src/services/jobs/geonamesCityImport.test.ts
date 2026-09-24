import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listCitiesForCountry, findCityInCountry, listCountries } from "@/services/jobs/referenceData";
import { resolveLocationReview } from "@/services/admin/locationReviews";
import curated from "../../../prisma/data-imports/2026-09-24-oil-and-gas-city-coverage/geonames-cities.curated.json";

/** Mirrors src/utils/slugify.ts exactly — see that file for the canonical implementation. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const TARGET_COUNTRIES: Record<string, string> = {
  OM: "Oman",
  BH: "Bahrain",
  BR: "Brazil",
  NG: "Nigeria",
  AO: "Angola",
  GY: "Guyana",
};

const ALLOWED_FEATURE_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPL"]);
const TIER1_CODES = new Set(["PPLC", "PPLA", "PPLA2"]);

type CuratedRow = { name: string; slug: string; population: number; featureCode: string; tier: 1 | 2 };
type CuratedCountry = { country: string; rows: CuratedRow[] };
const curatedData = curated as Record<string, CuratedCountry>;

/**
 * Covers the Oil & Gas market City-coverage import (Jobnura — Design and
 * Implement Controlled GeoNames City Backfill). The actual bulk database
 * write (prisma/data-imports/2026-09-24-oil-and-gas-city-coverage/import.sql)
 * was blocked by this environment's own destructive-write safety
 * classifier and has NOT been executed — these tests validate the
 * prepared, checked-in dataset's integrity and the general
 * resolution-mechanism compatibility using a small, isolated, cleaned-up
 * fixture, independent of whether the bulk import has run yet.
 */
describe("GeoNames Oil & Gas city-coverage import — curated dataset integrity", () => {
  it("1. touches exactly the six intended countries, matching the real, existing, active Country rows", async () => {
    const countries = await listCountries();
    for (const [iso, name] of Object.entries(TARGET_COUNTRIES)) {
      expect(Object.keys(curatedData)).toContain(iso);
      expect(curatedData[iso].country).toBe(name);
      const realCountry = countries.find((c) => c.name === name);
      expect(realCountry, `${name} must exist as a real, active Country row`).toBeDefined();
    }
    expect(Object.keys(curatedData).sort()).toEqual(Object.keys(TARGET_COUNTRIES).sort());
  });

  it("4. no duplicate (country, slug) pairs exist within the curated dataset itself", () => {
    for (const [iso, { rows }] of Object.entries(curatedData)) {
      const slugs = rows.map((r) => r.slug);
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size, `${iso} must have no duplicate slugs`).toBe(slugs.length);
    }
  });

  it("every curated row's slug matches this repo's own slugify() output for its name", () => {
    for (const { rows } of Object.values(curatedData)) {
      for (const row of rows) {
        expect(row.slug).toBe(slugify(row.name));
        expect(row.slug.length).toBeGreaterThan(0);
      }
    }
  });

  it("every curated row uses only the documented curation-rule feature codes, and every tier-2 row has a real recorded population", () => {
    for (const { rows } of Object.values(curatedData)) {
      for (const row of rows) {
        expect(ALLOWED_FEATURE_CODES.has(row.featureCode), `unexpected feature code ${row.featureCode}`).toBe(true);
        expect(row.tier === 1 || row.tier === 2).toBe(true);
        if (row.tier === 1) {
          expect(TIER1_CODES.has(row.featureCode)).toBe(true);
        } else {
          expect(row.population).toBeGreaterThan(0);
        }
      }
    }
  });

  it("the generated import.sql only ever references the six intended ISO codes, never another country", () => {
    const sql = readFileSync(
      new URL("../../../prisma/data-imports/2026-09-24-oil-and-gas-city-coverage/import.sql", import.meta.url),
      "utf8"
    );
    const referencedCodes = new Set(
      Array.from(sql.matchAll(/"isoCode"\s*=\s*'([A-Z]{2})'/g)).map((m) => m[1])
    );
    expect(referencedCodes).toEqual(new Set(Object.keys(TARGET_COUNTRIES)));
    expect(sql).toContain("ON CONFLICT (\"countryId\", \"slug\") DO NOTHING");
    expect(sql.match(/^BEGIN;/m)).not.toBeNull();
    expect(sql.match(/^COMMIT;/m)).not.toBeNull();
  });
});

/**
 * General resolution-mechanism compatibility (real dev database, a
 * single temporary, self-cleaning fixture row) — proves the EXISTING,
 * unmodified lookup/resolution functions correctly handle a new City row
 * in one of the six target countries, without depending on the bulk
 * import having actually run.
 */
describe("Location resolution mechanism works for a new city in a target Oil & Gas country (real dev database, temporary fixture)", () => {
  it("6 & 7. a newly added city is found by listCitiesForCountry/findCityInCountry and can resolve a pending location review", async () => {
    const oman = await prisma.country.findUniqueOrThrow({ where: { isoCode: "OM" }, select: { id: true } });
    const fixtureCity = await prisma.city.create({
      data: { countryId: oman.id, name: "[GEONAMES IMPORT TEST] Sample Town", slug: `geonames-import-test-sample-town-${crypto.randomUUID()}` },
      select: { id: true, slug: true },
    });

    try {
      const citiesForOman = await listCitiesForCountry(oman.id);
      expect(citiesForOman.some((c) => c.id === fixtureCity.id)).toBe(true);

      const found = await findCityInCountry(fixtureCity.slug, oman.id);
      expect(found?.id).toBe(fixtureCity.id);

      // Exercise the real, unmodified resolveLocationReview against a
      // throwaway review row pointing at Oman + this fixture city.
      const employer = await prisma.user.create({
        data: {
          email: `geonames-import-test-${crypto.randomUUID()}@example.invalid`,
          name: "[GEONAMES IMPORT TEST] Employer",
          role: "employer",
          status: "active",
          emailVerified: false,
        },
        select: { id: true },
      });
      try {
        const review = await prisma.importedJobReview.create({
          data: {
            importedSourceId: `geonames-import-test-source-${crypto.randomUUID()}`,
            importedExternalJobId: crypto.randomUUID(),
            title: "[GEONAMES IMPORT TEST] Sample Job",
            description: "A temporary automated-test review for the Oil & Gas city-coverage import.",
            decision: "admin_review",
            reasons: ["location_uncertain"],
            status: "pending",
            locationReviewStatus: "pending",
          },
          select: { id: true },
        });
        try {
          const result = await resolveLocationReview(review.id, oman.id, fixtureCity.id, employer.id);
          expect(result.success).toBe(true);

          const updated = await prisma.importedJobReview.findUniqueOrThrow({ where: { id: review.id } });
          expect(updated.locationReviewStatus).toBe("resolved");
          expect(updated.resolvedCountryId).toBe(oman.id);
          expect(updated.resolvedCityId).toBe(fixtureCity.id);
        } finally {
          await prisma.resolvedLocationAlias.deleteMany({ where: { cityId: fixtureCity.id } });
          await prisma.importedJobReview.delete({ where: { id: review.id } });
        }
      } finally {
        // resolveLocationReview logs a ModerationAction referencing this
        // admin user — must be cleared before the user can be deleted.
        await prisma.moderationAction.deleteMany({ where: { adminUserId: employer.id } });
        await prisma.user.delete({ where: { id: employer.id } });
      }
    } finally {
      await prisma.city.delete({ where: { id: fixtureCity.id } });
    }
  });

  it("8. a genuinely unresolvable location (no matching city anywhere) is still correctly rejected by resolveLocationReview", async () => {
    const oman = await prisma.country.findUniqueOrThrow({ where: { isoCode: "OM" }, select: { id: true } });
    const employer = await prisma.user.create({
      data: {
        email: `geonames-import-test-${crypto.randomUUID()}@example.invalid`,
        name: "[GEONAMES IMPORT TEST] Employer",
        role: "employer",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    try {
      const review = await prisma.importedJobReview.create({
        data: {
          importedSourceId: `geonames-import-test-source-${crypto.randomUUID()}`,
          importedExternalJobId: crypto.randomUUID(),
          title: "[GEONAMES IMPORT TEST] Unresolvable Job",
          description: "A temporary automated-test review.",
          decision: "admin_review",
          reasons: ["location_uncertain"],
          status: "pending",
          locationReviewStatus: "pending",
        },
        select: { id: true },
      });
      try {
        const result = await resolveLocationReview(review.id, oman.id, crypto.randomUUID(), employer.id);
        expect(result.success).toBe(false);
      } finally {
        await prisma.importedJobReview.delete({ where: { id: review.id } });
      }
    } finally {
      await prisma.user.delete({ where: { id: employer.id } });
    }
  });
});

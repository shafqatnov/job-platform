import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  findCountryByIsoCode,
  findCountryByName,
  findCityInCountry,
  listCountries,
  resolveCountryIdentifier,
} from "@/services/jobs/referenceData";
import { COUNTRY_ALIASES } from "@/constants/countryAliases";

const ALIASES_MODULE_SOURCE = readFileSync(new URL("../../constants/countryAliases.ts", import.meta.url), "utf8");
const REFERENCE_DATA_SOURCE = readFileSync(new URL("./referenceData.ts", import.meta.url), "utf8");

describe("referenceData: canonical country/city resolution (real dev database)", () => {
  it("1. Pakistan resolves to canonical PK", async () => {
    const expected = await prisma.country.findUniqueOrThrow({ where: { isoCode: "PK" }, select: { id: true } });
    const result = await resolveCountryIdentifier("Pakistan");
    expect(result?.id).toBe(expected.id);
  });

  it("2. UAE resolves to canonical AE", async () => {
    const expected = await prisma.country.findUniqueOrThrow({ where: { isoCode: "AE" }, select: { id: true } });
    const result = await resolveCountryIdentifier("UAE");
    expect(result?.id).toBe(expected.id);
  });

  it("3. United States resolves to exactly one canonical country across every spelling variant", async () => {
    const variants = ["United States", "United States of America", "USA", "US", "U.S."];
    const results = await Promise.all(variants.map((v) => resolveCountryIdentifier(v)));
    expect(results.every((r) => r !== null)).toBe(true);
    const ids = new Set(results.map((r) => r?.id));
    expect(ids.size).toBe(1);
  });

  it("4. United Kingdom resolves to exactly one canonical country across every spelling variant", async () => {
    const variants = ["United Kingdom", "UK", "GB", "Great Britain", "U.K."];
    const results = await Promise.all(variants.map((v) => resolveCountryIdentifier(v)));
    expect(results.every((r) => r !== null)).toBe(true);
    const ids = new Set(results.map((r) => r?.id));
    expect(ids.size).toBe(1);
  });

  it("5. ISO alpha-2 lookup works", async () => {
    const result = await findCountryByIsoCode("PK");
    expect(result?.name).toBe("Pakistan");
  });

  it("5b. ISO alpha-2 lookup is case-insensitive", async () => {
    const result = await findCountryByIsoCode("pk");
    expect(result?.name).toBe("Pakistan");
  });

  it("6. ISO alpha-3 lookup works via the alias map", async () => {
    const result = await resolveCountryIdentifier("PAK");
    expect(result?.name).toBe("Pakistan");
  });

  it("7. alias lookup works for common name variants", async () => {
    const result = await resolveCountryIdentifier("U.A.E.");
    expect(result?.name).toBe("United Arab Emirates");
  });

  it("8. alias lookup is case-insensitive", async () => {
    const lower = await resolveCountryIdentifier("uae");
    const upper = await resolveCountryIdentifier("UAE");
    const mixed = await resolveCountryIdentifier("UaE");
    expect(lower?.id).toBeTruthy();
    expect(lower?.id).toBe(upper?.id);
    expect(mixed?.id).toBe(upper?.id);
  });

  it("9. resolving 'USA' never creates a separate country row", async () => {
    const before = await prisma.country.count();
    await resolveCountryIdentifier("USA");
    const after = await prisma.country.count();
    expect(after).toBe(before);
  });

  it("10. resolving 'UAE' never creates a separate country row", async () => {
    const before = await prisma.country.count();
    await resolveCountryIdentifier("UAE");
    const after = await prisma.country.count();
    expect(after).toBe(before);
  });

  it("11. an unknown/unresolvable country never creates a database row", async () => {
    const before = await prisma.country.count();
    const result = await resolveCountryIdentifier(`Not A Real Country ${crypto.randomUUID()}`);
    const after = await prisma.country.count();
    expect(result).toBeNull();
    expect(after).toBe(before);
  });

  it("12. city lookup is scoped to a specific country", async () => {
    const pakistan = await prisma.country.findUniqueOrThrow({ where: { isoCode: "PK" }, select: { id: true } });
    const uae = await prisma.country.findUniqueOrThrow({ where: { isoCode: "AE" }, select: { id: true } });

    const karachiInPakistan = await findCityInCountry("karachi", pakistan.id);
    const karachiInUae = await findCityInCountry("karachi", uae.id);

    expect(karachiInPakistan?.name).toBe("Karachi");
    expect(karachiInUae).toBeNull();
  });

  it("13. Karachi + Pakistan resolves correctly end to end", async () => {
    const country = await resolveCountryIdentifier("Pakistan");
    expect(country).not.toBeNull();
    if (!country) return;
    const city = await findCityInCountry("karachi", country.id);
    expect(city?.name).toBe("Karachi");
  });

  it("14. existing candidate profile location records remain valid", async () => {
    const profile = await prisma.candidateProfile.findFirst({ select: { countryId: true, cityId: true } });
    if (!profile) return;
    const country = await prisma.country.findUnique({ where: { id: profile.countryId } });
    expect(country).not.toBeNull();
    if (profile.cityId) {
      const city = await prisma.city.findUnique({ where: { id: profile.cityId } });
      expect(city).not.toBeNull();
    }
  });

  it("15. existing job location records remain valid", async () => {
    const job = await prisma.job.findFirst({ select: { countryId: true, cityId: true } });
    if (!job) return;
    const country = await prisma.country.findUnique({ where: { id: job.countryId } });
    const city = await prisma.city.findUnique({ where: { id: job.cityId } });
    expect(country).not.toBeNull();
    expect(city).not.toBeNull();
  });

  it("16. country-only resolution never requires a city", async () => {
    const result = await resolveCountryIdentifier("Pakistan");
    expect(result).not.toBeNull();
  });

  it("17. a missing/unmatched city does not fail resolution or throw", async () => {
    const country = await resolveCountryIdentifier("Pakistan");
    expect(country).not.toBeNull();
    if (!country) return;
    const city = await findCityInCountry(`nonexistent-city-${crypto.randomUUID()}`, country.id);
    expect(city).toBeNull();
  });

  it("18. no duplicate canonical countries exist for any known name", async () => {
    const countries = await listCountries();
    const namesLower = countries.map((c) => c.name.toLowerCase());
    expect(new Set(namesLower).size).toBe(namesLower.length);
  });

  it("19. previously-existing referenced country IDs remain intact", async () => {
    const uae = await prisma.country.findUniqueOrThrow({ where: { isoCode: "AE" }, select: { id: true } });
    const us = await prisma.country.findUniqueOrThrow({ where: { isoCode: "US" }, select: { id: true } });
    const gb = await prisma.country.findUniqueOrThrow({ where: { isoCode: "GB" }, select: { id: true } });
    expect(uae.id).toBeTruthy();
    expect(us.id).toBeTruthy();
    expect(gb.id).toBeTruthy();
  });

  it("20. AI is never called for deterministic country resolution (no such dependency exists)", () => {
    expect(REFERENCE_DATA_SOURCE).not.toMatch(/openai/i);
    expect(ALIASES_MODULE_SOURCE).not.toMatch(/openai/i);
  });

  it("21. resolving a country never creates a Job", async () => {
    const before = await prisma.job.count();
    await resolveCountryIdentifier("Pakistan");
    const after = await prisma.job.count();
    expect(after).toBe(before);
  });

  it("22. resolving a country never changes any existing job's status", async () => {
    const activeCountBefore = await prisma.job.count({ where: { status: "active" } });
    await resolveCountryIdentifier("Pakistan");
    const activeCountAfter = await prisma.job.count({ where: { status: "active" } });
    expect(activeCountAfter).toBe(activeCountBefore);
  });

  it("23. no unrelated database row is changed by a resolution call", async () => {
    const userCountBefore = await prisma.user.count();
    const companyCountBefore = await prisma.company.count();
    await resolveCountryIdentifier("Pakistan");
    await findCountryByIsoCode("US");
    await findCountryByName("United Kingdom");
    expect(await prisma.user.count()).toBe(userCountBefore);
    expect(await prisma.company.count()).toBe(companyCountBefore);
  });

  it("every alias value in the alias map resolves to a real, existing Country row", async () => {
    const uniqueIsoCodes = new Set(Object.values(COUNTRY_ALIASES));
    for (const isoCode of uniqueIsoCodes) {
      const country = await findCountryByIsoCode(isoCode);
      expect(country, `alias target ISO code "${isoCode}" should resolve to a real Country row`).not.toBeNull();
    }
  });
});

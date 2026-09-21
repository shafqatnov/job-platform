import { prisma } from "@/lib/prisma";
import { COUNTRY_ALIASES } from "@/constants/countryAliases";

export type CountryOption = { id: string; slug: string; name: string };
export type CategoryOption = { id: string; slug: string; name: string };
export type CityOption = { id: string; slug: string; name: string; countryId: string };

/**
 * Database-backed reference-data reads for the job-creation form and its
 * server-side validation. Distinct from src/constants/countries.ts and
 * src/constants/categories.ts, which are static UI reference lists (used
 * by presentation-only public search filters) — these read the real
 * Country/Category/City rows a Job's foreign keys must actually point
 * to. Both the form's option lists and createJob's validation call these
 * same functions, so there is exactly one query path, not two.
 */

export async function listCountries(): Promise<CountryOption[]> {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    select: { id: true, urlSlug: true, name: true },
    orderBy: { name: "asc" },
  });
  return countries.map((c) => ({ id: c.id, slug: c.urlSlug, name: c.name }));
}

export async function listCategories(): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  return categories;
}

export async function listCities(): Promise<CityOption[]> {
  const cities = await prisma.city.findMany({
    select: { id: true, slug: true, name: true, countryId: true },
    orderBy: { name: "asc" },
  });
  return cities;
}

/**
 * Cities scoped to a single country — what every cascading Country ->
 * City selector actually needs, as opposed to listCities()'s full-table
 * read. Filters server-side on the indexed leading column of City's own
 * @@unique([countryId, slug]) constraint, so this stays a single fast,
 * targeted query regardless of how large the City table grows. Returns
 * an empty list for an unknown/invalid countryId rather than erroring —
 * callers already treat "no cities" as a normal, displayable state.
 */
export async function listCitiesForCountry(countryId: string): Promise<CityOption[]> {
  if (!countryId) {
    return [];
  }
  const cities = await prisma.city.findMany({
    where: { countryId },
    select: { id: true, slug: true, name: true, countryId: true },
    orderBy: { name: "asc" },
  });
  return cities;
}

export async function findCountryBySlug(slug: string): Promise<CountryOption | null> {
  const country = await prisma.country.findFirst({
    where: { urlSlug: slug, isActive: true },
    select: { id: true, urlSlug: true, name: true },
  });
  return country ? { id: country.id, slug: country.urlSlug, name: country.name } : null;
}

export async function findCategoryBySlug(slug: string): Promise<CategoryOption | null> {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
}

/** A city is only valid for a job if it belongs to the job's own resolved country. */
export async function findCityInCountry(slug: string, countryId: string): Promise<CityOption | null> {
  const city = await prisma.city.findFirst({
    where: { slug, countryId },
    select: { id: true, slug: true, name: true, countryId: true },
  });
  return city;
}

/** Looks up a country by its ISO 3166-1 alpha-2 code (case-insensitive). */
export async function findCountryByIsoCode(isoCode: string): Promise<CountryOption | null> {
  const country = await prisma.country.findFirst({
    where: { isoCode: { equals: isoCode.trim(), mode: "insensitive" }, isActive: true },
    select: { id: true, urlSlug: true, name: true },
  });
  return country ? { id: country.id, slug: country.urlSlug, name: country.name } : null;
}

/** Looks up a country by its exact canonical display name (case-insensitive). */
export async function findCountryByName(name: string): Promise<CountryOption | null> {
  const country = await prisma.country.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" }, isActive: true },
    select: { id: true, urlSlug: true, name: true },
  });
  return country ? { id: country.id, slug: country.urlSlug, name: country.name } : null;
}

/**
 * The main deterministic country resolver for free-text location input
 * (e.g. from an imported job source). Tries, in order: an exact ISO
 * alpha-2 match against real Country rows, the fixed alias map
 * (ISO alpha-3 codes and common name variants — see
 * countryAliases.ts) resolved back to a real Country row, then an exact
 * canonical-name match. Returns null ("unresolved") rather than ever
 * guessing, inventing, or creating a country — this function performs
 * no database write, and it is never routed through AI: deterministic
 * matching always happens first, and only a null result should ever be
 * escalated to a human/admin review or an AI-assisted stage.
 */
/** Trims and lowercases raw source location text so the exact same text always maps to the exact same alias key, regardless of casing/whitespace. */
export function normalizeLocationText(rawLocationText: string): string {
  return rawLocationText.trim().toLowerCase();
}

export type ResolvedLocationAliasResult = { countryId: string; cityId: string | null };

/**
 * Looks up a previously admin-resolved mapping for a raw, free-text
 * source location string (e.g. "Islamabad, Pakistan") — the persisted
 * knowledge from a completed unknown-location review (see
 * src/services/admin/locationReviews.ts). Read-only; never creates a
 * row. Returns null when this exact text has never been resolved
 * before, which is the normal case for anything not previously reviewed.
 */
export async function findResolvedLocationAlias(rawLocationText: string): Promise<ResolvedLocationAliasResult | null> {
  const normalizedAlias = normalizeLocationText(rawLocationText);
  if (!normalizedAlias) {
    return null;
  }

  const alias = await prisma.resolvedLocationAlias.findUnique({
    where: { normalizedAlias },
    select: { countryId: true, cityId: true },
  });
  return alias ? { countryId: alias.countryId, cityId: alias.cityId } : null;
}

export async function resolveCountryIdentifier(input: string): Promise<CountryOption | null> {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const byIsoCode = await findCountryByIsoCode(trimmed);
  if (byIsoCode) {
    return byIsoCode;
  }

  const aliasedIsoCode = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (aliasedIsoCode) {
    const byAlias = await findCountryByIsoCode(aliasedIsoCode);
    if (byAlias) {
      return byAlias;
    }
  }

  return findCountryByName(trimmed);
}

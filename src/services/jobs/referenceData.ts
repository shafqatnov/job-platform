import { prisma } from "@/lib/prisma";

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

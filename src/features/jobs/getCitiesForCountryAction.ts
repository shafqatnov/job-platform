"use server";

import { listCitiesForCountry, type CityOption } from "@/services/jobs/referenceData";

/**
 * Client-callable, country-scoped city lookup for every cascading
 * Country -> City selector (job posting, candidate profile, admin
 * unknown-location review). Public reference data — no auth check,
 * matching listCountries/listCategories/listCities' own unauthenticated
 * access (the same data any signed-out visitor can already see via
 * public job search). Returns an empty list rather than erroring for an
 * unknown/invalid countryId, exactly like listCitiesForCountry itself.
 */
export async function getCitiesForCountryAction(countryId: string): Promise<CityOption[]> {
  return listCitiesForCountry(countryId);
}

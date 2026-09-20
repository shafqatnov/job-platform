export type CountryOption = {
  /** Internal ISO 3166-1 alpha-2 identity — never changes for URL reasons. */
  code: string;
  /** Public URL segment for this country. Usually equal to `code`, but not
   *  always — e.g. the United Kingdom's code is "gb" while its friendly
   *  URL slug is "uk" (see docs/04-routing-and-url-strategy.md). */
  slug: string;
  name: string;
};

/**
 * Reference list of real countries for country-selector and browse UI.
 * This is not the list of markets actually live on the platform yet —
 * see docs/05-multi-country-architecture.md — it exists so the selector
 * and "Popular Countries" UI have real, honest option data to render
 * before any Country records exist in a database.
 */
export const COUNTRIES: CountryOption[] = [
  { code: "gb", slug: "uk", name: "United Kingdom" },
  { code: "ae", slug: "ae", name: "United Arab Emirates" },
  { code: "us", slug: "us", name: "United States" },
  { code: "ca", slug: "ca", name: "Canada" },
  { code: "au", slug: "au", name: "Australia" },
  { code: "de", slug: "de", name: "Germany" },
  { code: "sg", slug: "sg", name: "Singapore" },
  { code: "in", slug: "in", name: "India" },
  { code: "ch", slug: "ch", name: "Switzerland" },
  { code: "no", slug: "no", name: "Norway" },
  { code: "ie", slug: "ie", name: "Ireland" },
  { code: "nl", slug: "nl", name: "Netherlands" },
  { code: "lu", slug: "lu", name: "Luxembourg" },
  { code: "qa", slug: "qa", name: "Qatar" },
  { code: "sa", slug: "sa", name: "Saudi Arabia" },
  { code: "kw", slug: "kw", name: "Kuwait" },
  { code: "jp", slug: "jp", name: "Japan" },
  { code: "kr", slug: "kr", name: "South Korea" },
  { code: "hk", slug: "hk", name: "Hong Kong" },
  { code: "il", slug: "il", name: "Israel" },
  { code: "pk", slug: "pk", name: "Pakistan" },
];

/** Looks up a country by its internal ISO code (case-insensitive). */
export function getCountryByCode(code: string): CountryOption | undefined {
  const normalized = code.toLowerCase();
  return COUNTRIES.find((country) => country.code === normalized);
}

/** Looks up a country by its public URL slug (case-insensitive). Use this
 *  — not `getCountryByCode` — to resolve a country from a route segment. */
export function getCountryBySlug(slug: string): CountryOption | undefined {
  const normalized = slug.toLowerCase();
  return COUNTRIES.find((country) => country.slug === normalized);
}

/**
 * A curated subset shown on the homepage's "Popular Countries" grid, so
 * browsing there stays visually clean even as the full reference list
 * (used by filter dropdowns) grows. Order is intentional; prioritizes a
 * mix of established and high-paying markets.
 */
export const FEATURED_COUNTRY_SLUGS: string[] = [
  "uk",
  "us",
  "ae",
  "ca",
  "au",
  "de",
  "sg",
  "qa",
  "ch",
  "jp",
  "ie",
  "in",
];

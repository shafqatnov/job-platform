/**
 * Deterministic alias resolution for the canonical Country reference
 * data. Every key here is a free-text identifier a real job/location
 * source might use (an ISO 3166-1 alpha-2 or alpha-3 code, a common name
 * variant, or a common abbreviation); every value is the SAME canonical
 * ISO alpha-2 code (matching the existing Country.isoCode column) that
 * identifier means. This file never invents a country — every value
 * here must correspond to a real, already-seeded Country.isoCode row,
 * and this map is consulted only for lookup, never used to create one.
 *
 * Source: ISO 3166-1 alpha-2/alpha-3 codes as commonly published (see
 * the ISO 3166 Maintenance Agency's Online Browsing Platform,
 * https://www.iso.org/obp/ui/#search). These are long-stable,
 * well-established identifiers for existing sovereign states/recognized
 * areas that have not changed in decades. This environment has no live
 * internet access, so these codes were not looked up against the OBP
 * directly while writing this file — they reflect standard, widely
 * mirrored ISO 3166-1 knowledge. Verify against the OBP directly before
 * relying on this file as an authoritative source, and before adding any
 * jurisdiction not already covered here.
 *
 * Hong Kong (HK/HKG) has its own ISO 3166-1 entry as a Special
 * Administrative Region — not a sovereign state — and is included only
 * because Country.isoCode already stores it that way (pre-existing
 * schema data from before this task, not introduced here).
 *
 * Keys are matched case-insensitively by resolveCountryIdentifier in
 * referenceData.ts, which lowercases input before looking it up here —
 * every key below is written in lowercase for that reason.
 */
export const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  // Pakistan
  pakistan: "PK",
  pak: "PK",
  pk: "PK",

  // United Arab Emirates
  "united arab emirates": "AE",
  uae: "AE",
  "u.a.e.": "AE",
  are: "AE",
  ae: "AE",

  // United States
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  us: "US",

  // United Kingdom
  "united kingdom": "GB",
  uk: "GB",
  "u.k.": "GB",
  "great britain": "GB",
  gbr: "GB",
  gb: "GB",

  // Australia
  australia: "AU",
  aus: "AU",
  au: "AU",

  // Canada
  canada: "CA",
  can: "CA",
  ca: "CA",

  // Germany
  germany: "DE",
  deu: "DE",
  de: "DE",

  // Hong Kong
  "hong kong": "HK",
  hkg: "HK",
  hk: "HK",

  // India
  india: "IN",
  ind: "IN",
  in: "IN",

  // Ireland
  ireland: "IE",
  irl: "IE",
  ie: "IE",

  // Israel
  israel: "IL",
  isr: "IL",
  il: "IL",

  // Japan
  japan: "JP",
  jpn: "JP",
  jp: "JP",

  // Kuwait
  kuwait: "KW",
  kwt: "KW",
  kw: "KW",

  // Luxembourg
  luxembourg: "LU",
  lux: "LU",
  lu: "LU",

  // Netherlands
  netherlands: "NL",
  "the netherlands": "NL",
  nld: "NL",
  nl: "NL",

  // Norway
  norway: "NO",
  nor: "NO",
  no: "NO",

  // Qatar
  qatar: "QA",
  qat: "QA",
  qa: "QA",

  // Saudi Arabia
  "saudi arabia": "SA",
  sau: "SA",
  sa: "SA",

  // Singapore
  singapore: "SG",
  sgp: "SG",
  sg: "SG",

  // South Korea
  "south korea": "KR",
  "korea, republic of": "KR",
  kor: "KR",
  kr: "KR",

  // Switzerland
  switzerland: "CH",
  che: "CH",
  ch: "CH",
};

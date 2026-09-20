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
/**
 * Hand-curated common-name/abbreviation variants for the countries this
 * platform explicitly calls out most often. Deliberately not extended to
 * all 249 countries — colloquial variants beyond ISO codes are a
 * judgment call this task does not need to make for every jurisdiction,
 * and every country not listed here still resolves via its ISO alpha-2
 * (direct DB lookup), its ISO alpha-3 (GENERATED_ALPHA3_ALIASES below),
 * or its exact canonical name (resolveCountryIdentifier's own final
 * fallback in referenceData.ts).
 */
const CURATED_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
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

/**
 * ISO 3166-1 alpha-3 code -> alpha-2 code, for every officially-assigned
 * ISO 3166-1 entry (see the Country-table seed task's own final report
 * for the exact source/method: the npm package "world-countries",
 * version 5.1.0, filtered to status === "officially-assigned",
 * retrieved 2026-09-20 — not fetched live from the ISO OBP in this
 * environment). Generated once from that same dataset, not hand-typed —
 * this is what makes alpha-3 lookup work for the full global country
 * set, not just the countries called out in CURATED_COUNTRY_ALIASES
 * above. Verified (by referenceData.test.ts) that every value below
 * resolves to a real, existing Country.isoCode row.
 */
const GENERATED_ALPHA3_ALIASES: Readonly<Record<string, string>> = {
  and: "AD",
  are: "AE",
  afg: "AF",
  atg: "AG",
  aia: "AI",
  alb: "AL",
  arm: "AM",
  ago: "AO",
  ata: "AQ",
  arg: "AR",
  asm: "AS",
  aut: "AT",
  aus: "AU",
  abw: "AW",
  ala: "AX",
  aze: "AZ",
  bih: "BA",
  brb: "BB",
  bgd: "BD",
  bel: "BE",
  bfa: "BF",
  bgr: "BG",
  bhr: "BH",
  bdi: "BI",
  ben: "BJ",
  blm: "BL",
  bmu: "BM",
  brn: "BN",
  bol: "BO",
  bes: "BQ",
  bra: "BR",
  bhs: "BS",
  btn: "BT",
  bvt: "BV",
  bwa: "BW",
  blr: "BY",
  blz: "BZ",
  can: "CA",
  cck: "CC",
  cod: "CD",
  caf: "CF",
  cog: "CG",
  che: "CH",
  civ: "CI",
  cok: "CK",
  chl: "CL",
  cmr: "CM",
  chn: "CN",
  col: "CO",
  cri: "CR",
  cub: "CU",
  cpv: "CV",
  cuw: "CW",
  cxr: "CX",
  cyp: "CY",
  cze: "CZ",
  deu: "DE",
  dji: "DJ",
  dnk: "DK",
  dma: "DM",
  dom: "DO",
  dza: "DZ",
  ecu: "EC",
  est: "EE",
  egy: "EG",
  esh: "EH",
  eri: "ER",
  esp: "ES",
  eth: "ET",
  fin: "FI",
  fji: "FJ",
  flk: "FK",
  fsm: "FM",
  fro: "FO",
  fra: "FR",
  gab: "GA",
  gbr: "GB",
  grd: "GD",
  geo: "GE",
  guf: "GF",
  ggy: "GG",
  gha: "GH",
  gib: "GI",
  grl: "GL",
  gmb: "GM",
  gin: "GN",
  glp: "GP",
  gnq: "GQ",
  grc: "GR",
  sgs: "GS",
  gtm: "GT",
  gum: "GU",
  gnb: "GW",
  guy: "GY",
  hkg: "HK",
  hmd: "HM",
  hnd: "HN",
  hrv: "HR",
  hti: "HT",
  hun: "HU",
  idn: "ID",
  irl: "IE",
  isr: "IL",
  imn: "IM",
  ind: "IN",
  iot: "IO",
  irq: "IQ",
  irn: "IR",
  isl: "IS",
  ita: "IT",
  jey: "JE",
  jam: "JM",
  jor: "JO",
  jpn: "JP",
  ken: "KE",
  kgz: "KG",
  khm: "KH",
  kir: "KI",
  com: "KM",
  kna: "KN",
  prk: "KP",
  kor: "KR",
  kwt: "KW",
  cym: "KY",
  kaz: "KZ",
  lao: "LA",
  lbn: "LB",
  lca: "LC",
  lie: "LI",
  lka: "LK",
  lbr: "LR",
  lso: "LS",
  ltu: "LT",
  lux: "LU",
  lva: "LV",
  lby: "LY",
  mar: "MA",
  mco: "MC",
  mda: "MD",
  mne: "ME",
  maf: "MF",
  mdg: "MG",
  mhl: "MH",
  mkd: "MK",
  mli: "ML",
  mmr: "MM",
  mng: "MN",
  mac: "MO",
  mnp: "MP",
  mtq: "MQ",
  mrt: "MR",
  msr: "MS",
  mlt: "MT",
  mus: "MU",
  mdv: "MV",
  mwi: "MW",
  mex: "MX",
  mys: "MY",
  moz: "MZ",
  nam: "NA",
  ncl: "NC",
  ner: "NE",
  nfk: "NF",
  nga: "NG",
  nic: "NI",
  nld: "NL",
  nor: "NO",
  npl: "NP",
  nru: "NR",
  niu: "NU",
  nzl: "NZ",
  omn: "OM",
  pan: "PA",
  per: "PE",
  pyf: "PF",
  png: "PG",
  phl: "PH",
  pak: "PK",
  pol: "PL",
  spm: "PM",
  pcn: "PN",
  pri: "PR",
  pse: "PS",
  prt: "PT",
  plw: "PW",
  pry: "PY",
  qat: "QA",
  reu: "RE",
  rou: "RO",
  srb: "RS",
  rus: "RU",
  rwa: "RW",
  sau: "SA",
  slb: "SB",
  syc: "SC",
  sdn: "SD",
  swe: "SE",
  sgp: "SG",
  shn: "SH",
  svn: "SI",
  sjm: "SJ",
  svk: "SK",
  sle: "SL",
  smr: "SM",
  sen: "SN",
  som: "SO",
  sur: "SR",
  ssd: "SS",
  stp: "ST",
  slv: "SV",
  sxm: "SX",
  syr: "SY",
  swz: "SZ",
  tca: "TC",
  tcd: "TD",
  atf: "TF",
  tgo: "TG",
  tha: "TH",
  tjk: "TJ",
  tkl: "TK",
  tls: "TL",
  tkm: "TM",
  tun: "TN",
  ton: "TO",
  tur: "TR",
  tto: "TT",
  tuv: "TV",
  twn: "TW",
  tza: "TZ",
  ukr: "UA",
  uga: "UG",
  umi: "UM",
  usa: "US",
  ury: "UY",
  uzb: "UZ",
  vat: "VA",
  vct: "VC",
  ven: "VE",
  vgb: "VG",
  vir: "VI",
  vnm: "VN",
  vut: "VU",
  wlf: "WF",
  wsm: "WS",
  yem: "YE",
  myt: "YT",
  zaf: "ZA",
  zmb: "ZM",
  zwe: "ZW",
};

/** The merged, exported alias map — generated alpha-3 codes first, curated colloquial variants layered on top (identical values either way for any overlapping key). */
export const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  ...GENERATED_ALPHA3_ALIASES,
  ...CURATED_COUNTRY_ALIASES,
};

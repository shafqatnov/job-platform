/**
 * The Adzuna Jobs API connector — the first job-AGGREGATOR-type source
 * feeding the AI Job Acquisition Engine's pipeline (mirrors
 * greenhouseConnector.ts's own architecture and doc comment exactly):
 *
 *   AuthorizedJobSource Registry -> Connector (this file) -> Raw Job ->
 *   Validation -> Duplicate Detection -> AI Normalization -> Confidence
 *   Decision -> Auto Publish OR Admin Review
 *
 * This module is ONLY the connector step. It:
 *  - reads Adzuna's official REST Search API (read-only, GET only, no
 *    application submission, no employer contact)
 *  - transforms an Adzuna job into Jobnura's internal raw-job shape
 *  - returns that data to its caller
 *
 * It deliberately does NOT: read or write the AuthorizedJobSource
 * registry itself (a caller passes in the already-fetched source row),
 * call OpenAI or classify/rewrite anything, deduplicate beyond basic
 * external-job identity, or create/publish any Jobnura Job row. Those
 * are later pipeline stages living in their own modules — this file
 * never imports Prisma and never writes to any database.
 *
 * CREDENTIALS: Adzuna requires two credentials (app_id + app_key), sent
 * as query-string parameters on every request per Adzuna's own
 * documented mechanism (https://developer.adzuna.com/docs/search) —
 * there is no header-based alternative. Both are read ONLY from
 * process.env here, server-side, never accepted as a function
 * parameter from a caller and never returned in any result or logged in
 * any error message (a network failure log names the source/country
 * only, exactly like greenhouseConnector.ts's own request-failure log —
 * never the constructed URL, which would contain both credentials as
 * query params).
 *
 * COUNTRY SCOPE: Adzuna's Search API is one endpoint PER supported
 * country code (ISO 3166-1 alpha-2, lowercase) — there is no
 * "search all countries" call. ADZUNA_SUPPORTED_COUNTRY_CODES below is
 * this connector's own explicit allow-list (never guessed per-request);
 * a caller must pass one of these. This list should be reconfirmed
 * against Adzuna's current developer-portal/account access before
 * expanding beyond the two countries this task's controlled first test
 * uses (gb, us) — Adzuna's publicly documented country coverage has
 * been stable for years but was not independently re-verified from
 * this environment.
 *
 * ADZUNA API TERMS (see https://developer.adzuna.com and the project
 * owner's own Adzuna account for the current, authoritative terms):
 *  - Attribution: every surface displaying Adzuna-sourced listings must
 *    show "Jobs by Adzuna" with a link back to Adzuna — see
 *    src/features/jobs/AdzunaAttribution.tsx, wired into JobCard.tsx.
 *  - Rate limits / request volume: this connector deliberately caps
 *    results_per_page (see MAX_RESULTS_PER_PAGE below) and is never
 *    called on a tight/automatic polling loop — the importer layer
 *    controls scheduling, not this file.
 *  - Removal obligation: if Adzuna API access is ever terminated, every
 *    Job row with source === "imported" and importedSourceId pointing
 *    at the Adzuna AuthorizedJobSource row must be removed/unpublished
 *    — the existing admin job-lifecycle tools (not this connector)
 *    handle that; noted here so the obligation isn't lost.
 *  - This connector never contacts an employer or any third party named
 *    in a listing — it only reads Adzuna's own API response.
 */

import type { JobSourceType } from "@/generated/prisma/enums";

const REQUEST_TIMEOUT_MS = 15_000;

// A conservative, explicit hard cap — independent of whatever value a
// caller requests — so this connector itself can never be responsible
// for an unexpectedly large pull, matching this task's "controlled
// first test of 10-20 listings, do not crawl the entire index" scope.
const MAX_RESULTS_PER_PAGE = 20;
const DEFAULT_RESULTS_PER_PAGE = 20;

// See this file's own header doc comment — reconfirm against Adzuna's
// current account/developer-portal access before adding a country.
export const ADZUNA_SUPPORTED_COUNTRY_CODES = [
  "gb",
  "us",
  "at",
  "au",
  "br",
  "ca",
  "de",
  "fr",
  "in",
  "it",
  "mx",
  "nl",
  "nz",
  "pl",
  "sg",
  "za",
] as const;
export type AdzunaCountryCode = (typeof ADZUNA_SUPPORTED_COUNTRY_CODES)[number];

export type AdzunaRawJob = {
  sourceId: string;
  externalJobId: string;
  title: string;
  location: string | null;
  /** Adzuna's search response provides a description SNIPPET, not a guaranteed complete long-form posting — never presented downstream as a complete employer description. */
  description: string | null;
  /** Adzuna's own `redirect_url` — the exact, unmodified external application/source destination. Never replaced with a Jobnura-owned URL. */
  sourceUrl: string | null;
  /** Adzuna's own `created` timestamp (this source has no separate "updated" concept) — mapped into the same slot Job.importedSourceUpdatedAt already uses for every other source. */
  updatedAt: string;
  rawSourceType: "API";
  companyIdentity: string | null;
  // Adzuna has no department/office concept — always empty, kept only
  // for structural compatibility with ValidatableRawJob (which every
  // imported-job pipeline stage already accepts this shape for).
  departments: string[];
  offices: string[];

  /** The Adzuna country code this listing was fetched under (see ADZUNA_SUPPORTED_COUNTRY_CODES) — preserved for audit; never used to invent a Jobnura Country row (see referenceData.ts's own no-invention rule). */
  adzunaCountryCode: AdzunaCountryCode;
  /** Adzuna's own category label (e.g. "IT Jobs") — a different vocabulary from Jobnura's own Category table; kept for audit/reference only, not force-mapped onto Jobnura's canonical categories. */
  adzunaCategory: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  /**
   * Not populated: Adzuna's Search API response does not include an
   * explicit per-job currency code field (only salary_min/salary_max/
   * salary_is_predicted) — see this task's own "salary currency IF
   * RELIABLY AVAILABLE" wording. Deriving one from the search country
   * would be an inference, not a value Adzuna actually returned, so
   * this connector deliberately leaves it null rather than guessing.
   */
  salaryCurrency: null;
  /** Adzuna's own flag for whether the salary range is an estimate rather than employer-stated — preserved so a later stage can treat it appropriately; never dropped silently. */
  salaryIsPredicted: boolean;
  contractType: string | null;
  contractTime: string | null;
};

export type FetchAdzunaJobsResult =
  | { success: true; jobs: AdzunaRawJob[] }
  | { success: false; error: string };

/** The minimal AuthorizedJobSource shape this connector needs — decoupled from the admin registry's own row type, matching greenhouseConnector.ts's own GreenhouseConnectorSource. */
export type AdzunaConnectorSource = {
  id: string;
  sourceType: JobSourceType;
  enabled: boolean;
  /** Adzuna's documented API base, e.g. "https://api.adzuna.com/v1/api" — never a per-employer URL (Adzuna is one shared aggregator, not per-employer like an ATS). */
  baseEndpoint: string | null;
};

export type RunAdzunaConnectorOptions = {
  countryCode: AdzunaCountryCode;
  /** 1-based, matching Adzuna's own /search/{page} path convention. Defaults to 1. */
  page?: number;
  /** Capped at MAX_RESULTS_PER_PAGE regardless of what's requested. Defaults to DEFAULT_RESULTS_PER_PAGE. */
  resultsPerPage?: number;
  /**
   * Adzuna's own documented `what` search-keyword parameter (see
   * https://developer.adzuna.com/docs/search) — sent only when provided.
   * Omitting it (the original, still-supported behavior) queries a
   * country's generic, unfiltered results exactly as before; every
   * existing caller that doesn't pass this continues to behave
   * identically.
   */
  keyword?: string;
};

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Transforms one raw Adzuna job object into Jobnura's internal raw
 * shape. Returns null (rather than throwing) when a required field is
 * missing or malformed, so one bad record never breaks the whole batch
 * — same contract as greenhouseConnector.ts's parseGreenhouseJob.
 * Never invents a value that wasn't in the source payload.
 */
function parseAdzunaJob(raw: unknown, sourceId: string, countryCode: AdzunaCountryCode): AdzunaRawJob | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const job = raw as Record<string, unknown>;

  const externalJobId =
    typeof job.id === "number" || typeof job.id === "string" ? String(job.id).trim() : "";
  const title = typeof job.title === "string" ? job.title.trim() : "";
  if (!externalJobId || !title) {
    return null;
  }

  const company = job.company;
  const companyIdentity =
    company && typeof company === "object" && "display_name" in company
      ? toNullableString((company as { display_name: unknown }).display_name)
      : null;

  const location = job.location;
  const locationDisplayName =
    location && typeof location === "object" && "display_name" in location
      ? toNullableString((location as { display_name: unknown }).display_name)
      : null;

  const category = job.category;
  const categoryLabel =
    category && typeof category === "object" && "label" in category
      ? toNullableString((category as { label: unknown }).label)
      : null;

  return {
    sourceId,
    externalJobId,
    title,
    location: locationDisplayName,
    description: toNullableString(job.description),
    sourceUrl: toNullableString(job.redirect_url),
    updatedAt: toNullableString(job.created) ?? "",
    rawSourceType: "API",
    companyIdentity,
    departments: [],
    offices: [],
    adzunaCountryCode: countryCode,
    adzunaCategory: categoryLabel,
    salaryMin: toNullableNumber(job.salary_min),
    salaryMax: toNullableNumber(job.salary_max),
    salaryCurrency: null,
    salaryIsPredicted: job.salary_is_predicted === true || job.salary_is_predicted === "1" || job.salary_is_predicted === 1,
    contractType: toNullableString(job.contract_type),
    contractTime: toNullableString(job.contract_time),
  };
}

/**
 * Fetches and transforms one page of one Adzuna country's search
 * results. Pure fetch -> validate -> transform -> return — no registry
 * access, no eligibility checks (see runAdzunaConnector for that gate),
 * no database writes.
 */
async function fetchAdzunaSearchPage(
  sourceId: string,
  baseEndpoint: string,
  appId: string,
  appKey: string,
  options: RunAdzunaConnectorOptions
): Promise<FetchAdzunaJobsResult> {
  const page = options.page ?? 1;
  const resultsPerPage = Math.min(options.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE, MAX_RESULTS_PER_PAGE);

  let url: URL;
  try {
    url = new URL(`${baseEndpoint}/jobs/${options.countryCode}/search/${page}`);
  } catch {
    return { success: false, error: "This source's endpoint is not a valid URL." };
  }
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  if (options.keyword) {
    url.searchParams.set("what", options.keyword);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (error) {
    // Never include the raw error or the request URL (both credentials
    // are query params on it) — only a safe, generic operational log line.
    console.error(`adzunaConnector: request failed for source ${sourceId} (country ${options.countryCode})`);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: isAbort ? "The Adzuna API timed out." : "Could not reach the Adzuna API.",
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`adzunaConnector: non-2xx response (${response.status}) for source ${sourceId} (country ${options.countryCode})`);
    return { success: false, error: "The Adzuna API returned an unexpected response." };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error(`adzunaConnector: malformed JSON for source ${sourceId} (country ${options.countryCode})`);
    return { success: false, error: "The Adzuna API returned malformed data." };
  }

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
    console.error(`adzunaConnector: response missing a results array for source ${sourceId} (country ${options.countryCode})`);
    return { success: false, error: "The Adzuna API response was missing the expected results list." };
  }

  const rawJobs = (payload as { results: unknown[] }).results;
  const jobs: AdzunaRawJob[] = [];
  for (const raw of rawJobs) {
    const parsed = parseAdzunaJob(raw, sourceId, options.countryCode);
    if (parsed) {
      jobs.push(parsed);
    }
  }

  return { success: true, jobs };
}

/**
 * The connector's entry point. Only ever fetches Adzuna when the
 * caller-supplied source is enabled, correctly typed as API, and has a
 * base endpoint configured — this is the registry gate the task
 * requires, re-checked here rather than trusted from the caller,
 * matching runGreenhouseConnector's own gate exactly. Also requires
 * both ADZUNA_APP_ID and ADZUNA_APP_KEY to be present in process.env;
 * if either is absent, fails with a generic configuration error rather
 * than a credential-revealing one.
 */
export async function runAdzunaConnector(
  source: AdzunaConnectorSource,
  options: RunAdzunaConnectorOptions
): Promise<FetchAdzunaJobsResult> {
  if (!source.enabled) {
    return { success: false, error: "This source is disabled." };
  }
  if (source.sourceType !== "API") {
    return { success: false, error: "This source is not configured as an API source." };
  }
  if (!source.baseEndpoint) {
    return { success: false, error: "This source has no API base endpoint configured." };
  }
  if (!ADZUNA_SUPPORTED_COUNTRY_CODES.includes(options.countryCode)) {
    return { success: false, error: "This country is not supported by the Adzuna connector." };
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.error("adzunaConnector: ADZUNA_APP_ID/ADZUNA_APP_KEY are not configured for this environment.");
    return { success: false, error: "This source's credentials are not configured." };
  }

  return fetchAdzunaSearchPage(source.id, source.baseEndpoint, appId, appKey, options);
}

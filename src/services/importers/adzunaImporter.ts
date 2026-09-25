/**
 * The Adzuna importer/orchestrator — the layer that connects the
 * AuthorizedJobSource registry to the Adzuna connector, across a small,
 * explicit set of countries:
 *
 *   Registry -> Importer (this file) -> Connector -> Raw Job
 *
 * Mirrors greenhouseImporter.ts's own orchestration-only role exactly:
 * it reads which source is configured/eligible, calls the existing
 * connector once per country in the controlled set, and collects the
 * results. It deliberately does NOT: validate jobs beyond what the
 * connector already guarantees, deduplicate, call OpenAI or run
 * moderation, or write/publish anything to the Job table. Those are
 * later, separate pipeline stages.
 *
 * CONTROLLED-FIRST-TEST SCOPE: this task explicitly caps the first live
 * run at 10-20 total listings across a small, relevant country set —
 * never "crawl the entire index." CONTROLLED_TEST_COUNTRY_CODES and
 * CONTROLLED_TEST_TOTAL_JOB_LIMIT below are that explicit cap, enforced
 * here (stops calling further countries once the running total already
 * meets the limit) rather than left to chance. Widening this to
 * continuous/broader importing is a deliberate future decision, not
 * something this importer does on its own.
 */

import { listJobSources, type JobSourceRow } from "@/services/admin/jobSources";
import {
  runAdzunaConnector,
  type AdzunaCountryCode,
  type AdzunaRawJob,
} from "@/services/connectors/adzunaConnector";

// Adzuna's API always lives on this host. The registry has no dedicated
// "provider" field yet (sourceType "API" is shared by any future
// non-ATS aggregator), so — exactly like greenhouseImporter.ts's own
// isGreenhouseSource — the smallest safe way to identify a source as
// Adzuna without guessing from free-text `notes` is to check the actual
// endpoint the connector would call.
const ADZUNA_HOSTNAME = "api.adzuna.com";

function isAdzunaSource(source: Pick<JobSourceRow, "sourceType" | "baseEndpoint">): boolean {
  if (source.sourceType !== "API" || !source.baseEndpoint) {
    return false;
  }
  try {
    return new URL(source.baseEndpoint).hostname === ADZUNA_HOSTNAME;
  } catch {
    return false;
  }
}

// Two of Adzuna's flagship, highest-coverage markets — both map
// trivially to real Jobnura Country rows via their ISO alpha-2 code
// (see referenceData.ts's findCountryByIsoCode). Adjust only as a
// deliberate decision, not silently.
export const CONTROLLED_TEST_COUNTRY_CODES: readonly AdzunaCountryCode[] = ["gb", "us"];
export const CONTROLLED_TEST_TOTAL_JOB_LIMIT = 20;
const CONTROLLED_TEST_RESULTS_PER_PAGE = 10; // 2 countries x 10 = the 20-listing cap.

export type AdzunaCountryImportResult =
  | { countryCode: AdzunaCountryCode; success: true; importedRawJobCount: number }
  | { countryCode: AdzunaCountryCode; success: false; importedRawJobCount: 0; error: string };

export type AdzunaImportSummary = {
  results: AdzunaCountryImportResult[];
  totalSourcesConsidered: number;
  totalSourcesEligible: boolean;
  totalRawJobsImported: number;
  jobs: AdzunaRawJob[];
};

/**
 * Reads the registry, selects the enabled Adzuna API source (if any),
 * and runs the connector once per country in CONTROLLED_TEST_COUNTRY_CODES
 * — stopping early once the combined result count reaches
 * CONTROLLED_TEST_TOTAL_JOB_LIMIT, so this never issues a request whose
 * result it doesn't need. One country's failure never stops the others,
 * since every per-country call is individually caught here (matching
 * runGreenhouseImporter's own per-source isolation).
 */
export async function runAdzunaImporter(): Promise<AdzunaImportSummary> {
  const sources = await listJobSources();
  const adzunaSource = sources.find((source) => source.enabled && isAdzunaSource(source));

  if (!adzunaSource) {
    return {
      results: [],
      totalSourcesConsidered: sources.length,
      totalSourcesEligible: false,
      totalRawJobsImported: 0,
      jobs: [],
    };
  }

  const results: AdzunaCountryImportResult[] = [];
  const jobs: AdzunaRawJob[] = [];

  for (const countryCode of CONTROLLED_TEST_COUNTRY_CODES) {
    if (jobs.length >= CONTROLLED_TEST_TOTAL_JOB_LIMIT) {
      break;
    }

    try {
      const remaining = CONTROLLED_TEST_TOTAL_JOB_LIMIT - jobs.length;
      const result = await runAdzunaConnector(
        { id: adzunaSource.id, sourceType: adzunaSource.sourceType, enabled: adzunaSource.enabled, baseEndpoint: adzunaSource.baseEndpoint },
        { countryCode, resultsPerPage: Math.min(CONTROLLED_TEST_RESULTS_PER_PAGE, remaining) }
      );

      if (!result.success) {
        console.error(`adzunaImporter: country ${countryCode} failed: ${result.error}`);
        results.push({ countryCode, success: false, importedRawJobCount: 0, error: result.error });
        continue;
      }

      const accepted = result.jobs.slice(0, CONTROLLED_TEST_TOTAL_JOB_LIMIT - jobs.length);
      jobs.push(...accepted);
      results.push({ countryCode, success: true, importedRawJobCount: accepted.length });
    } catch {
      // Never let one country's unexpected failure interrupt the
      // others, and never surface a raw error (which could include
      // response details) to whatever calls this importer.
      console.error(`adzunaImporter: unexpected error processing country ${countryCode}`);
      results.push({ countryCode, success: false, importedRawJobCount: 0, error: "This country could not be processed right now." });
    }
  }

  return {
    results,
    totalSourcesConsidered: sources.length,
    totalSourcesEligible: true,
    totalRawJobsImported: jobs.length,
    jobs,
  };
}

// -----------------------------------------------------------------------
// Oil & Gas expansion (controlled Phase 1 rollout) — a SEPARATE, additive
// capability living alongside runAdzunaImporter() above, which is left
// completely unmodified (still used by its own existing tests/callers
// unchanged). syncAdzunaJobs.ts calls the function below instead, going
// forward, per "Jobnura — Adzuna Oil & Gas Expansion v1.0."
//
// Design: a deterministic, stateless, time-bucketed ROTATING WINDOW over
// the full (country x keyword profile) matrix. Rather than one huge run
// covering every combination at once (56 combinations today — 8
// countries x 7 profiles — far beyond the ~16-24 request/cycle target),
// each 6-hour sync cycle covers only one bounded slice of the matrix,
// selected purely from the current wall-clock time (no persisted
// "cursor" state needed, no schema change). Full coverage completes
// every ceil(56/20) = 3 cycles (~18 hours), then repeats.
//
// This intentionally does NOT attempt the most aggressive possible query
// matrix, per this task's own explicit instruction — it is a
// conservative starting budget, adjustable later via the options this
// function already accepts.
// -----------------------------------------------------------------------

/**
 * The 8 Adzuna-supported countries that overlap Jobnura's own country
 * model (see the Global Oil & Gas Adzuna Expansion Audit). Deliberately
 * does NOT include UAE, Saudi Arabia, Qatar, Kuwait, Oman, Bahrain,
 * Norway, Brazil, Nigeria, Angola, or Guyana — Adzuna does not operate
 * in most of those markets at all, and the ones that recently gained
 * City reference-data coverage (Oman, Bahrain, Brazil, Nigeria, Angola,
 * Guyana) are a LOCATION-reference-data improvement, unrelated to and
 * never implying Adzuna source coverage there. Source coverage and
 * location-reference coverage are deliberately kept separate.
 */
export const OIL_AND_GAS_COUNTRY_CODES: readonly AdzunaCountryCode[] = ["au", "ca", "de", "gb", "in", "nl", "sg", "us"];

/**
 * A small, deliberately conservative starter set of Oil & Gas keyword
 * profiles, sent as Adzuna's own documented `what` search parameter.
 * Chosen to be specific enough to stay relevant (never a bare generic
 * term like "energy" or "engineer" that would flood results with
 * unrelated roles) while still covering upstream ("oil", "gas",
 * "petroleum", "upstream"), drilling/oilfield ("drilling", "oilfield"),
 * and offshore work specifically.
 *
 * Deliberately NOT yet included, pending real-volume evidence from this
 * starter set: "subsea", "pipeline", "LNG", "refinery"/"refining",
 * "petrochemical", "exploration", "geoscience", "reservoir",
 * "completion", "workover", "rig operations", "oilfield services",
 * "EPC". Several of these substantially overlap with what "oil",
 * "petroleum", or "oilfield" already surface; others (e.g. bare "EPC")
 * risk false-positive matches with unrelated engineering-procurement
 * roles outside Oil & Gas. Expanding this list is a deliberate future
 * decision once Phase 1's actual results are reviewed, not something
 * this rollout does blindly.
 */
export const OIL_AND_GAS_SEARCH_PROFILES: readonly string[] = [
  "oil",
  "gas",
  "petroleum",
  "drilling",
  "offshore",
  "upstream",
  "oilfield",
];

export type OilAndGasSyncBudget = {
  /** Hard ceiling on real Adzuna API requests in a single run — the actual safety mechanism, independent of result volume. */
  maxRequestsPerRun: number;
  /** Hard ceiling on raw candidate jobs collected in a single run, protecting the admin review queue from runaway growth. */
  maxNewCandidatesPerRun: number;
  /** Phase 1 = 1 (page 1 only). Raise only after Phase 1 is validated — see docs/17-job-sourcing-and-content-integrity.md conventions for how this pipeline documents deliberate scope decisions. */
  maxPagesPerQuery: number;
  /** Results requested per page, per (country, profile, page) query — deliberately below the connector's own MAX_RESULTS_PER_PAGE ceiling (unchanged) to favor relevance over raw volume. */
  resultsPerPage: number;
};

/**
 * Phase 1 rollout budget: 8 countries x 7 profiles = 56 combinations;
 * a 20-request rotating window covers the whole matrix roughly every 3
 * sync cycles (~18 hours) at 4 cycles/day, comfortably inside Adzuna's
 * documented 250 hits/day limit (20 requests x 4 cycles/day = 80/day,
 * well under 250) with substantial headroom left for the existing
 * legacy runAdzunaImporter() path and normal manual admin sync
 * clicks. maxNewCandidatesPerRun=100 is set relative to the current
 * genuine pending-review backlog (~100 real Adzuna reviews) — a single
 * run should not be able to more than double it outright.
 */
export const OIL_AND_GAS_SYNC_BUDGET: OilAndGasSyncBudget = {
  maxRequestsPerRun: 20,
  maxNewCandidatesPerRun: 100,
  maxPagesPerQuery: 1,
  resultsPerPage: 10,
};

export type OilAndGasCombination = { countryCode: AdzunaCountryCode; keyword: string };

/** Deterministic, stable ordering — country-major, profile-minor — never randomized. */
export function buildOilAndGasCombinations(
  countryCodes: readonly AdzunaCountryCode[] = OIL_AND_GAS_COUNTRY_CODES,
  profiles: readonly string[] = OIL_AND_GAS_SEARCH_PROFILES
): OilAndGasCombination[] {
  const combinations: OilAndGasCombination[] = [];
  for (const countryCode of countryCodes) {
    for (const keyword of profiles) {
      combinations.push({ countryCode, keyword });
    }
  }
  return combinations;
}

/**
 * Selects one bounded, deterministic slice of the full combination
 * matrix for "right now" — purely a function of the current time and
 * the matrix itself, so no persisted cursor/state is needed anywhere
 * (no schema change). The same wall-clock 6-hour bucket always maps to
 * the same slice, matching the existing sync-adzuna.yml cron cadence
 * exactly (every 6 hours, on the hour), so consecutive real sync runs
 * naturally advance through the matrix rather than re-querying the
 * same slice repeatedly.
 */
export function selectOilAndGasWindow(
  combinations: readonly OilAndGasCombination[],
  windowSize: number,
  nowMs: number,
  cycleLengthMs: number = 6 * 60 * 60 * 1000
): OilAndGasCombination[] {
  if (combinations.length === 0 || windowSize <= 0) {
    return [];
  }
  const totalBatches = Math.ceil(combinations.length / windowSize);
  const bucket = Math.floor(nowMs / cycleLengthMs);
  const batchIndex = bucket % totalBatches;
  const start = batchIndex * windowSize;
  return combinations.slice(start, start + windowSize);
}

export type OilAndGasQueryOutcome = {
  countryCode: AdzunaCountryCode;
  keyword: string;
  page: number;
  success: boolean;
  resultCount: number;
  error?: string;
};

export type OilAndGasSyncSummary = {
  results: OilAndGasQueryOutcome[];
  totalSourcesEligible: boolean;
  requestsUsed: number;
  requestBudget: number;
  candidatesCollected: number;
  candidateBudget: number;
  requestBudgetReached: boolean;
  candidateBudgetReached: boolean;
  /** How many (country, profile) combinations exist beyond this run's window — reported, never silently dropped. A future sync run's own time-based window will cover them. */
  combinationsDeferredToFutureRuns: number;
  jobs: AdzunaRawJob[];
};

export type RunAdzunaOilAndGasImporterOptions = Partial<OilAndGasSyncBudget> & {
  countryCodes?: readonly AdzunaCountryCode[];
  profiles?: readonly string[];
  /** Injected for deterministic tests; defaults to the real current time. */
  now?: () => number;
};

/**
 * The Oil & Gas expansion entry point. Re-derives eligibility from the
 * same registry as runAdzunaImporter() (never trusts a caller), then
 * queries a bounded, deterministic slice of the (country, keyword
 * profile) matrix — never the whole matrix in one run — respecting BOTH
 * an independent request-count budget and an independent
 * candidate-count budget, whichever is hit first. Each (country,
 * keyword) pair pages forward only while maxPagesPerQuery and both
 * budgets allow it, and stops early the moment a page returns fewer
 * results than requested (no more inventory for that pair right now).
 * One combination's failure never stops another (mirrors
 * runAdzunaImporter's own per-country isolation).
 */
export async function runAdzunaOilAndGasImporter(
  options: RunAdzunaOilAndGasImporterOptions = {}
): Promise<OilAndGasSyncSummary> {
  const budget: OilAndGasSyncBudget = { ...OIL_AND_GAS_SYNC_BUDGET, ...options };
  const now = options.now ?? Date.now;

  const sources = await listJobSources();
  const adzunaSource = sources.find((source) => source.enabled && isAdzunaSource(source));

  if (!adzunaSource) {
    return {
      results: [],
      totalSourcesEligible: false,
      requestsUsed: 0,
      requestBudget: budget.maxRequestsPerRun,
      candidatesCollected: 0,
      candidateBudget: budget.maxNewCandidatesPerRun,
      requestBudgetReached: false,
      candidateBudgetReached: false,
      combinationsDeferredToFutureRuns: 0,
      jobs: [],
    };
  }

  const allCombinations = buildOilAndGasCombinations(
    options.countryCodes ?? OIL_AND_GAS_COUNTRY_CODES,
    options.profiles ?? OIL_AND_GAS_SEARCH_PROFILES
  );
  const window = selectOilAndGasWindow(allCombinations, budget.maxRequestsPerRun, now());

  const results: OilAndGasQueryOutcome[] = [];
  const jobs: AdzunaRawJob[] = [];
  let requestsUsed = 0;

  const sourceForConnector = {
    id: adzunaSource.id,
    sourceType: adzunaSource.sourceType,
    enabled: adzunaSource.enabled,
    baseEndpoint: adzunaSource.baseEndpoint,
  };

  combinationLoop: for (const combination of window) {
    for (let page = 1; page <= budget.maxPagesPerQuery; page++) {
      if (requestsUsed >= budget.maxRequestsPerRun || jobs.length >= budget.maxNewCandidatesPerRun) {
        break combinationLoop;
      }

      const remaining = budget.maxNewCandidatesPerRun - jobs.length;
      let outcome: OilAndGasQueryOutcome;
      try {
        const result = await runAdzunaConnector(sourceForConnector, {
          countryCode: combination.countryCode,
          page,
          resultsPerPage: Math.min(budget.resultsPerPage, remaining),
          keyword: combination.keyword,
        });
        requestsUsed += 1;

        if (!result.success) {
          outcome = { ...combination, page, success: false, resultCount: 0, error: result.error };
          results.push(outcome);
          break; // don't keep paginating a combination that just failed
        }

        const accepted = result.jobs.slice(0, remaining);
        jobs.push(...accepted);
        outcome = { ...combination, page, success: true, resultCount: accepted.length };
        results.push(outcome);

        if (result.jobs.length < budget.resultsPerPage) {
          break; // no more pages for this combination right now
        }
      } catch {
        requestsUsed += 1;
        console.error(`adzunaImporter: unexpected error processing ${combination.countryCode}/${combination.keyword}`);
        results.push({ ...combination, page, success: false, resultCount: 0, error: "This combination could not be processed right now." });
        break;
      }
    }
  }

  return {
    results,
    totalSourcesEligible: true,
    requestsUsed,
    requestBudget: budget.maxRequestsPerRun,
    candidatesCollected: jobs.length,
    candidateBudget: budget.maxNewCandidatesPerRun,
    requestBudgetReached: requestsUsed >= budget.maxRequestsPerRun,
    candidateBudgetReached: jobs.length >= budget.maxNewCandidatesPerRun,
    combinationsDeferredToFutureRuns: allCombinations.length - window.length,
    jobs,
  };
}

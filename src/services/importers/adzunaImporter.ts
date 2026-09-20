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

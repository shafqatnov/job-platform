/**
 * The Greenhouse importer/orchestrator — the layer that connects the
 * AuthorizedJobSource registry to the Greenhouse connector:
 *
 *   Registry -> Importer (this file) -> Connector -> Raw Job
 *
 * This module is ONLY orchestration. It reads which sources are
 * configured and eligible, calls the existing connector once per
 * eligible source, and collects the results. It deliberately does NOT:
 * validate jobs beyond what the connector already guarantees,
 * deduplicate beyond the connector's own external-job identity, call
 * OpenAI or run moderation, or write/publish anything to the Job table.
 * Those are later, separate pipeline stages.
 */

import { listJobSources, type JobSourceRow } from "@/services/admin/jobSources";
import { runGreenhouseConnector, type GreenhouseRawJob } from "@/services/connectors/greenhouseConnector";

// Greenhouse's public Job Board API always lives on this host. The
// registry has no dedicated "provider" field yet (only sourceType, which
// is shared by every ATS-type source — Greenhouse, Lever, Ashby, ...),
// so the smallest safe way to identify a source as Greenhouse — without
// guessing from free-text `notes` — is to check the actual endpoint the
// connector would call. This can never disagree with what the connector
// itself does, since it reads the very same field. A future dedicated
// provider identifier on AuthorizedJobSource would be a cleaner
// long-term signal; adding one wasn't necessary for this task.
const GREENHOUSE_HOSTNAME = "boards-api.greenhouse.io";

function isGreenhouseSource(source: Pick<JobSourceRow, "sourceType" | "baseEndpoint">): boolean {
  if (source.sourceType !== "ATS" || !source.baseEndpoint) {
    return false;
  }
  try {
    return new URL(source.baseEndpoint).hostname === GREENHOUSE_HOSTNAME;
  } catch {
    return false;
  }
}

export type GreenhouseSourceImportResult =
  | {
      sourceId: string;
      sourceName: string;
      success: true;
      importedRawJobCount: number;
      jobs: GreenhouseRawJob[];
    }
  | {
      sourceId: string;
      sourceName: string;
      success: false;
      importedRawJobCount: 0;
      error: string;
    };

export type GreenhouseImportSummary = {
  results: GreenhouseSourceImportResult[];
  totalSourcesConsidered: number;
  totalSourcesEligible: number;
  totalRawJobsImported: number;
};

/**
 * Reads the registry, selects enabled Greenhouse ATS sources, and runs
 * the connector for each one independently — one source failing (a bad
 * endpoint, a Greenhouse outage, an unexpected exception) never stops
 * the others, since every per-source call is individually caught here.
 * Returns raw jobs only; nothing is validated, deduplicated beyond the
 * connector's own external-job identity, sent to AI, or published.
 */
export async function runGreenhouseImporter(): Promise<GreenhouseImportSummary> {
  const sources = await listJobSources();
  const eligibleSources = sources.filter((source) => source.enabled && isGreenhouseSource(source));

  const results = await Promise.all(
    eligibleSources.map(async (source): Promise<GreenhouseSourceImportResult> => {
      try {
        const result = await runGreenhouseConnector({
          id: source.id,
          sourceType: source.sourceType,
          enabled: source.enabled,
          baseEndpoint: source.baseEndpoint,
        });

        if (!result.success) {
          console.error(`greenhouseImporter: source ${source.id} failed: ${result.error}`);
          return {
            sourceId: source.id,
            sourceName: source.name,
            success: false,
            importedRawJobCount: 0,
            error: result.error,
          };
        }

        return {
          sourceId: source.id,
          sourceName: source.name,
          success: true,
          importedRawJobCount: result.jobs.length,
          jobs: result.jobs,
        };
      } catch {
        // Never let one source's unexpected failure interrupt the others,
        // and never surface a raw error (which could include response
        // details) to whatever calls this importer.
        console.error(`greenhouseImporter: unexpected error processing source ${source.id}`);
        return {
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          importedRawJobCount: 0,
          error: "This source could not be processed right now.",
        };
      }
    })
  );

  return {
    results,
    totalSourcesConsidered: sources.length,
    totalSourcesEligible: eligibleSources.length,
    totalRawJobsImported: results.reduce((sum, result) => sum + result.importedRawJobCount, 0),
  };
}

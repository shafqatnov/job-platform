/**
 * The Greenhouse Job Board connector — the first of a future family of
 * source connectors feeding the AI Job Acquisition Engine's pipeline:
 *
 *   AuthorizedJobSource Registry -> Connector -> Raw Job -> Validation ->
 *   Duplicate Detection -> AI Normalization -> Confidence Decision ->
 *   Auto Publish OR Admin Review
 *
 * This module is ONLY the connector step. It:
 *  - reads Greenhouse's official, public Job Board JSON API (read-only,
 *    no Harvest API, no scraping, no application submission)
 *  - transforms a Greenhouse job into Jobnura's internal raw-job shape
 *  - returns that data to its caller
 *
 * It deliberately does NOT: read or write the AuthorizedJobSource
 * registry itself (a caller passes in the already-fetched source row),
 * call OpenAI or classify/rewrite anything, deduplicate beyond basic
 * external-job identity, or create/publish any Jobnura Job row. Those
 * are later pipeline stages living in their own modules.
 *
 * Greenhouse's public Job Board endpoint
 * (https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs) needs
 * no API key for GET requests, so no credential is stored or read here
 * — the board's full jobs URL is simply the source's own
 * AuthorizedJobSource.baseEndpoint, which is not a secret (Greenhouse
 * board tokens are already public, visible in the URL itself).
 */

import type { JobSourceType } from "@/generated/prisma/enums";

const REQUEST_TIMEOUT_MS = 15_000;

export type GreenhouseRawJob = {
  sourceId: string;
  externalJobId: string;
  title: string;
  location: string | null;
  /** The job's full HTML content, only populated when the board was queried with ?content=true. */
  description: string | null;
  sourceUrl: string | null;
  /** ISO 8601 timestamp as reported by Greenhouse, preserved verbatim — never re-derived. */
  updatedAt: string;
  rawSourceType: "ATS";
  companyIdentity: string | null;
  departments: string[];
  offices: string[];
};

export type FetchGreenhouseJobsResult =
  | { success: true; jobs: GreenhouseRawJob[] }
  | { success: false; error: string };

/** The minimal AuthorizedJobSource shape this connector needs — decoupled from the admin registry's own row type. */
export type GreenhouseConnectorSource = {
  id: string;
  sourceType: JobSourceType;
  enabled: boolean;
  baseEndpoint: string | null;
};

function extractName(value: unknown): string | null {
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

function extractNameList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(extractName).filter((name): name is string => name !== null);
}

/**
 * Transforms one raw Greenhouse job object into Jobnura's internal raw
 * shape. Returns null (rather than throwing) when a required field is
 * missing or malformed, so one bad record never breaks the whole batch.
 * Never invents a value that wasn't in the source payload.
 */
function parseGreenhouseJob(raw: unknown, sourceId: string): GreenhouseRawJob | null {
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

  return {
    sourceId,
    externalJobId,
    title,
    location: extractName(job.location),
    description: typeof job.content === "string" ? job.content : null,
    sourceUrl: typeof job.absolute_url === "string" ? job.absolute_url : null,
    updatedAt: typeof job.updated_at === "string" ? job.updated_at : "",
    rawSourceType: "ATS",
    companyIdentity: typeof job.company_name === "string" ? job.company_name : null,
    departments: extractNameList(job.departments),
    offices: extractNameList(job.offices),
  };
}

/**
 * Fetches and transforms every job on one Greenhouse board. Pure
 * fetch -> validate -> transform -> return — no registry access, no
 * eligibility checks (see runGreenhouseConnector for that gate), no
 * database writes.
 */
async function fetchGreenhouseBoardJobs(sourceId: string, boardJobsUrl: string): Promise<FetchGreenhouseJobsResult> {
  let url: URL;
  try {
    url = new URL(boardJobsUrl);
  } catch {
    return { success: false, error: "This source's endpoint is not a valid URL." };
  }
  url.searchParams.set("content", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (error) {
    // Never include the raw error (which could echo back the request URL/
    // headers) — only a safe, generic operational log line.
    console.error(`greenhouseConnector: request failed for source ${sourceId}`);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: isAbort ? "The Greenhouse job board timed out." : "Could not reach the Greenhouse job board.",
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`greenhouseConnector: non-2xx response (${response.status}) for source ${sourceId}`);
    return { success: false, error: "The Greenhouse job board returned an unexpected response." };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error(`greenhouseConnector: malformed JSON for source ${sourceId}`);
    return { success: false, error: "The Greenhouse job board returned malformed data." };
  }

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    console.error(`greenhouseConnector: response missing a jobs array for source ${sourceId}`);
    return { success: false, error: "The Greenhouse job board response was missing the expected jobs list." };
  }

  const rawJobs = (payload as { jobs: unknown[] }).jobs;
  const jobs: GreenhouseRawJob[] = [];
  for (const raw of rawJobs) {
    const parsed = parseGreenhouseJob(raw, sourceId);
    if (parsed) {
      jobs.push(parsed);
    }
  }

  return { success: true, jobs };
}

/**
 * The connector's entry point. Only ever fetches Greenhouse when the
 * caller-supplied source is enabled, correctly typed as ATS, and has an
 * endpoint configured — this is the registry gate the task requires,
 * re-checked here rather than trusted from the caller, so this
 * connector can never be invoked against a disabled or misconfigured
 * source even by mistake.
 */
export async function runGreenhouseConnector(source: GreenhouseConnectorSource): Promise<FetchGreenhouseJobsResult> {
  if (!source.enabled) {
    return { success: false, error: "This source is disabled." };
  }
  if (source.sourceType !== "ATS") {
    return { success: false, error: "This source is not configured as an ATS source." };
  }
  if (!source.baseEndpoint) {
    return { success: false, error: "This source has no board endpoint configured." };
  }

  return fetchGreenhouseBoardJobs(source.id, source.baseEndpoint);
}

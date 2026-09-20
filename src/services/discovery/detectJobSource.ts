/**
 * The source-detection layer for the future, industry-agnostic AI Job
 * Acquisition Engine. Sits BEFORE the registry/connector layer in the
 * target architecture:
 *
 *   Admin / Source URL -> Source Detector (this file) -> Provider
 *   identified -> Correct Connector -> Importer -> ... -> Publish
 *
 * This module does ONE thing: given a URL, classify which known ATS/
 * career-source PROVIDER it belongs to, deterministically, from the URL
 * alone. It performs NO outbound network request (so it carries no SSRF
 * risk at all — it never fetches anything, just parses and pattern-
 * matches the string it's given), calls no AI, writes nothing to any
 * database, and does not decide whether a source is authorized to use —
 * that remains a separate, human/compliance decision recorded in the
 * AuthorizedJobSource registry, never inferred here.
 *
 * Kept deliberately separate from jobSources.ts (registry config),
 * greenhouseConnector.ts (the only real fetch-capable connector so far),
 * and every future connector — this file must never gain provider-
 * specific FETCHING logic; it only classifies a URL string.
 *
 * ---------------------------------------------------------------------
 * PROVIDER PATTERN VERIFICATION (read before extending this file):
 *
 * Every pattern below was checked against that provider's own live,
 * reachable documentation or a real, currently-functioning endpoint
 * before being added — never invented or guessed from a company name in
 * a URL. Two providers considered for this task were deliberately LEFT
 * OUT because their pattern could not be confidently verified this way:
 *
 *  - Personio: no live, populated example or reachable official
 *    documentation confirming a stable public hostname pattern could be
 *    found. URLs on personio.com/personio.de are classified "unknown"
 *    until this is verified.
 *  - Recruitee is included, but only at "medium" confidence: the
 *    `{company}.recruitee.com` subdomain-routing infrastructure was
 *    confirmed to exist and behave in a company-specific way (an
 *    unrecognized subdomain redirects to a distinct fallback page), but
 *    no live, populated example board was found to confirm the exact
 *    public path shape.
 *
 * The other six providers below were each confirmed against a real,
 * reachable source (official docs and/or a live, currently-functioning
 * endpoint) on 2026-09-20:
 *  - Greenhouse: https://docs.greenhouse.io/job-board.html
 *  - Lever: https://hire.lever.co/developer/documentation, plus a live
 *    `GET api.lever.co/v0/postings/lever` returning a valid JSON response
 *  - Ashby: https://developers.ashbyhq.com/docs/public-job-posting-api
 *  - Workday: a real company's live careers page linking to
 *    `cignacareers` on `cigna.wd5.myworkdayjobs.com`
 *  - Workable: a live `apply.workable.com/workable/` board page, plus
 *    https://workable.readme.io/ (official API docs)
 *  - Teamtailor: https://docs.teamtailor.com/
 * ---------------------------------------------------------------------
 */

export type JobSourceProvider =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "workable"
  | "teamtailor"
  | "recruitee"
  | "unknown";

export type DetectedSourceType = "ATS" | "FEED" | "API" | "OFFICIAL_CAREER_SOURCE" | "UNKNOWN";

export type JobSourceDetectionConfidence = "high" | "medium" | "low";

export type JobSourceDetectionResult = {
  provider: JobSourceProvider;
  sourceType: DetectedSourceType;
  confidence: JobSourceDetectionConfidence;
  /** The input URL with only safe, non-destructive normalization applied (see normalizeParsedUrl) — null when the input could not be parsed as a URL at all. */
  normalizedEndpoint: string | null;
  /** Human-readable explanation of why this result was reached — never a command, never trusted as anything but a log/display string. */
  reason: string;
};

function unknownResult(normalizedEndpoint: string | null, reason: string): JobSourceDetectionResult {
  return { provider: "unknown", sourceType: "UNKNOWN", confidence: "low", normalizedEndpoint, reason };
}

/**
 * Strips only a trailing slash from a non-root pathname. Never touches
 * hostname casing (the URL parser already lowercases it), query string,
 * or any path segment content — a provider's board token/company slug
 * living in the path is never altered.
 */
function normalizeParsedUrl(url: URL): string {
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

const WORKDAY_HOSTNAME_PATTERN = /^[a-z0-9-]+\.wd[1-5]\.myworkdayjobs\.com$/;
const WORKABLE_SUBDOMAIN_PATTERN = /^[a-z0-9-]+\.workable\.com$/;
const TEAMTAILOR_SUBDOMAIN_PATTERN = /^[a-z0-9-]+\.teamtailor\.com$/;
const RECRUITEE_SUBDOMAIN_PATTERN = /^[a-z0-9-]+\.recruitee\.com$/;

/**
 * Classifies a URL by known ATS/career-source provider. Deterministic
 * and pure — the same input always produces the same output, no network
 * call, no randomness, no AI. Returns provider "unknown" (not a guess,
 * not an error) whenever the hostname doesn't confidently match one of
 * the verified patterns above, including for malformed input.
 *
 * Hostname matching is exact-equality or `$`-anchored-regex only —
 * never a substring/`.includes()` check — specifically so a spoofing
 * attempt like `boards.greenhouse.io.attacker.example` (a real, valid
 * hostname whose OWN suffix is `.attacker.example`, not Greenhouse's
 * domain) is correctly classified as unknown rather than matched.
 */
export function detectJobSource(input: string): JobSourceDetectionResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return unknownResult(null, "Input is not a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return unknownResult(null, `Unsupported URL scheme "${url.protocol}" — only http/https are recognized.`);
  }

  const hostname = url.hostname.toLowerCase();
  const normalizedEndpoint = normalizeParsedUrl(url);

  if (hostname === "boards.greenhouse.io" || hostname === "boards-api.greenhouse.io") {
    return {
      provider: "greenhouse",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Greenhouse's verified public job-board hostname.",
    };
  }

  if (hostname === "jobs.lever.co" || hostname === "api.lever.co") {
    return {
      provider: "lever",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Lever's verified public job-board hostname.",
    };
  }

  if (hostname === "jobs.ashbyhq.com" || hostname === "api.ashbyhq.com") {
    return {
      provider: "ashby",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Ashby's verified public job-board hostname.",
    };
  }

  if (WORKDAY_HOSTNAME_PATTERN.test(hostname)) {
    return {
      provider: "workday",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Workday's verified numbered career-site hosting pattern (wd1-wd5.myworkdayjobs.com).",
    };
  }

  if (hostname === "apply.workable.com") {
    return {
      provider: "workable",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Workable's verified public job-board hostname.",
    };
  }

  if (WORKABLE_SUBDOMAIN_PATTERN.test(hostname) && hostname !== "www.workable.com") {
    return {
      provider: "workable",
      sourceType: "ATS",
      confidence: "medium",
      normalizedEndpoint,
      reason:
        "Matched Workable's account-subdomain pattern (verified for their API endpoint; this exact subdomain form as a public HTML board was not independently confirmed).",
    };
  }

  if (TEAMTAILOR_SUBDOMAIN_PATTERN.test(hostname) && hostname !== "www.teamtailor.com") {
    return {
      provider: "teamtailor",
      sourceType: "ATS",
      confidence: "high",
      normalizedEndpoint,
      reason: "Matched Teamtailor's verified career-site subdomain pattern.",
    };
  }

  if (RECRUITEE_SUBDOMAIN_PATTERN.test(hostname) && hostname !== "www.recruitee.com") {
    return {
      provider: "recruitee",
      sourceType: "ATS",
      confidence: "medium",
      normalizedEndpoint,
      reason:
        "Matched Recruitee's subdomain-routing pattern (confirmed to exist and behave per-company; a live populated example board was not found during verification).",
    };
  }

  // Personio deliberately has no rule here — see the module doc comment
  // above for why (pattern could not be confidently verified).

  return unknownResult(normalizedEndpoint, "No known, verified provider hostname pattern matched.");
}

/**
 * Mandatory attribution for a listing imported from the Adzuna API.
 * Adzuna's API Terms require every displayed advert sourced from their
 * API to carry visible "Jobs by Adzuna" attribution with a link back to
 * Adzuna (see adzunaConnector.ts's own header doc comment for the
 * fuller compliance notes: rate limits, removal-on-termination
 * obligation, no third-party contact). This component is the ONE place
 * that renders it, so the label/link/styling can never drift between
 * JobCard and the job-detail page.
 *
 * Never render this for a non-Adzuna listing — callers gate it on
 * `job.isAdzunaSourced` (see adzunaAttribution.ts / getPublicJobs.ts /
 * getPublicJobBySlug.ts), never shown "just in case."
 */

// Adzuna's per-country web domain, for a link that's specific to the
// country the listing was sourced under rather than always the global
// .com — falls back to adzuna.com for any country not in this small,
// explicit map. Reconfirm against Adzuna's current domains if adding a
// new country to ADZUNA_SUPPORTED_COUNTRY_CODES in adzunaConnector.ts.
const ADZUNA_COUNTRY_DOMAINS: Record<string, string> = {
  GB: "https://www.adzuna.co.uk",
  US: "https://www.adzuna.com",
  AT: "https://www.adzuna.at",
  AU: "https://www.adzuna.com.au",
  BR: "https://www.adzuna.com.br",
  CA: "https://www.adzuna.ca",
  DE: "https://www.adzuna.de",
  FR: "https://www.adzuna.fr",
  IN: "https://www.adzuna.in",
  IT: "https://www.adzuna.it",
  MX: "https://www.adzuna.com.mx",
  NL: "https://www.adzuna.nl",
  NZ: "https://www.adzuna.co.nz",
  PL: "https://www.adzuna.pl",
  SG: "https://www.adzuna.sg",
  ZA: "https://www.adzuna.co.za",
};
const ADZUNA_DEFAULT_DOMAIN = "https://www.adzuna.com";

export type AdzunaAttributionProps = {
  /** The job's ISO alpha-2 country code, used only to pick which Adzuna domain to link to. */
  countryCode?: string;
  className?: string;
};

export function AdzunaAttribution({ countryCode, className }: AdzunaAttributionProps) {
  const href = (countryCode && ADZUNA_COUNTRY_DOMAINS[countryCode.toUpperCase()]) || ADZUNA_DEFAULT_DOMAIN;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground ${className ?? ""}`}
    >
      Jobs by Adzuna
    </a>
  );
}

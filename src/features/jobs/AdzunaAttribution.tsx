/**
 * Mandatory attribution for a listing imported from the Adzuna API.
 * This component is the ONE place that renders it, so the markup can
 * never drift between JobCard and the job-detail page.
 *
 * Never render this for a non-Adzuna listing — callers gate it on
 * `job.isAdzunaSourced` (see adzunaAttribution.ts / getPublicJobs.ts /
 * getPublicJobBySlug.ts), never shown "just in case."
 *
 * COMPLIANCE (per Adzuna's own official Terms of Service, "API user
 * Obligations" — https://developer.adzuna.com/docs/terms_of_service,
 * verified directly, not from a third-party summary): an API user
 * "shall label each displayed advert with the phrase 'Jobs by Adzuna'
 * at least 116 x 23 pixels in size, wherein the word 'Jobs' shall be
 * hyperlinked to [the local Adzuna domain] ... and the word 'Adzuna'
 * shall be the Adzuna Logo Image and shall also be hyperlinked to
 * [the local Adzuna domain]." This is implemented as closely as this
 * task could verify safely:
 *  - "Jobs" is its own hyperlink to the country-specific Adzuna domain
 *    (unchanged from before — ADZUNA_COUNTRY_DOMAINS below).
 *  - "Adzuna" is a separate, also-hyperlinked element, sized to meet
 *    the 116x23px minimum.
 *
 * KNOWN, OPEN GAP: the "Adzuna" word is still rendered as styled TEXT,
 * not the official Adzuna Logo Image. This session could not safely
 * obtain that image — Adzuna's own press/brand page
 * (adzuna.co.uk/press.html) returned 403 Forbidden to automated
 * fetching, and no other verified, correctly-licensed source of the
 * actual logo asset was available. Rendering an unverified or
 * third-party-sourced image as "the Adzuna Logo Image" would itself be
 * inventing attribution, which is explicitly not acceptable — so this
 * deliberately stays honest text pending a real asset file (obtained
 * directly from Adzuna) being added to this component. Replace this
 * <span> with an <Image>/<img> referencing that real asset once
 * available; do not fabricate one.
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
    <span
      className={`inline-flex min-h-5.75 min-w-29 items-center gap-1 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:text-foreground">
        Jobs
      </a>
      <span aria-hidden="true">by</span>
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold hover:text-foreground">
        Adzuna
      </a>
    </span>
  );
}

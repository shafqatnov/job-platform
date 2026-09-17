# 21. AdSense Readiness

AdSense is considered from the beginning, as required, but this document makes no assumption that AdSense approval or meaningful ad revenue is guaranteed — the principles below only ensure the platform doesn't have to be re-architected if/when AdSense is added.

## Non-negotiable principle

- **[CONFIRMED]** Monetization must never compromise the core job-search experience. Ad placement is subordinate to the search, browse, and apply flows — not the other way around.

## Ad-slot placement

- **[RECOMMENDED]** Ad slots are reserved in public page templates (job listing pages, job detail pages) in positions that don't interrupt the primary task: e.g. sidebar (desktop), between-listings in a search results feed (at a bounded frequency, not between every item), or below the main content — never overlaying or preceding the search bar, filters, or the "Apply" action.
- **[RECOMMENDED]** Ad containers are given fixed/reserved dimensions in the layout from the start, so that ad loading does not cause layout shift — this is also a direct Core Web Vitals requirement (see below and [10-seo-architecture.md](10-seo-architecture.md)).
- **[CONFIRMED]** Authenticated dashboard areas (candidate, employer, admin) do not carry ads. Ads are a public-page-only concern, consistent with the public/dashboard separation already established in [04](04-routing-and-url-strategy.md) and [10](10-seo-architecture.md).

## Policy pages

- **[CONFIRMED]** The following pages are required before applying for AdSense and are treated as a launch requirement (see [25-launch-checklist.md](25-launch-checklist.md)), not an optional extra: Privacy Policy, Terms of Service, About, and Contact.
- **[RECOMMENDED]** The Privacy Policy explicitly discloses use of cookies/ads and any analytics in plain language, kept accurate as those integrations are actually added (not written speculatively ahead of what's true).

## Consent

- **[RECOMMENDED]** A cookie/ad-personalization consent mechanism is presented to visitors where required (e.g. EU/UK visitors), gating ad-personalization and non-essential analytics cookies until consent is given. This is shared infrastructure with the analytics consent requirement in [23-analytics-and-measurement.md](23-analytics-and-measurement.md) — one consent system, not two.

## Performance / Core Web Vitals

- **[CONFIRMED]** Ad and analytics scripts are loaded asynchronously/deferred and must not degrade the Core Web Vitals targets already established for SEO in [10-seo-architecture.md](10-seo-architecture.md). A regression in page speed caused by ad tooling is treated as a defect, not an acceptable tradeoff.

## Explicit non-guarantees

- **[CONFIRMED]** This blueprint does not assume AdSense approval will be granted, that approval will happen by any particular date, or that ad revenue will be material. The platform must function, and be judged as launched, entirely independent of whether AdSense is active.

## Deferred

- **[DEFERRED]** Actual AdSense account setup/approval process, ad density tuning, and any alternative/complementary ad network — all post-launch operational decisions, not architecture.

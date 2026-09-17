# 10. SEO Architecture Principles

SEO is a primary acquisition channel for this platform (see [01-product-vision-and-scope.md](01-product-vision-and-scope.md)), so public pages are treated as a first-class concern, not an afterthought bolted onto a dashboard-first app.

## Core principle

- **[CONFIRMED]** Public, crawlable pages (job listings, job detail, company profiles, marketing/landing pages) are conceptually and structurally separate from authenticated dashboard areas (see [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md), [06-user-boundaries.md](06-user-boundaries.md)). Dashboards are excluded from sitemaps and disallowed in `robots.txt`.

## Rendering principles

- **[RECOMMENDED]** Public pages use server-side rendering or static/incremental generation (Next.js SSR/ISR) rather than client-side-only rendering, so content is available to crawlers without executing JavaScript.
- **[RECOMMENDED]** Semantic HTML and structured data (schema.org `JobPosting` for job pages, `Organization` for company pages) so listings are eligible for rich results (e.g. Google Jobs).
- **[RECOMMENDED]** Core Web Vitals (load speed, layout stability, interactivity) are treated as an SEO requirement, not just a UX nicety. This constraint applies directly to ad and analytics scripts as well — see [21-adsense-readiness.md](21-adsense-readiness.md) and [23-analytics-and-measurement.md](23-analytics-and-measurement.md); a monetization or measurement integration that degrades these metrics is a defect.

## Multi-country SEO

- Per-country sitemaps and `hreflang` annotations once multiple country/locale combinations exist (see [05-multi-country-architecture.md](05-multi-country-architecture.md)), to prevent duplicate-content issues and serve the correct market's page in search results.

## URL durability

- **[RECOMMENDED]** Job and company slugs are treated as durable identifiers. Renamed or removed listings need a redirect strategy (e.g. 301 to a relevant current listing or category page) rather than resulting in broken links from indexed search results — the specific redirect implementation is a Phase 1 build detail, not decided here.

## Measuring whether this works

- **[CONFIRMED]** Whether this SEO architecture actually produces organic traffic is not assumed — it is measured post-launch via the basic analytics defined as a launch requirement in [23-analytics-and-measurement.md](23-analytics-and-measurement.md).

## Deferred / future growth levers

- **[DEFERRED]** Programmatic SEO (e.g. auto-generated "[role] jobs in [city]" pages at scale). The data model and routing should not preclude this later, but it is not part of MVP scope (see [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)).
- **[DEFERRED]** Specific sitemap generation tooling/cadence, and specific structured-data fields beyond the general `JobPosting`/`Organization` types noted above.

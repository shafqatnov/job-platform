# 1. Product Vision and Scope

## Vision

A global job platform connecting candidates and employers across multiple countries, built to earn organic search visibility through useful, fresh, trustworthy job content — with AI and automation as a planned enhancement layer added once the core platform is live, not a launch dependency.

- **[CONFIRMED]** The platform is not marketed or positioned as "AI-powered" at launch, since no AI capability ships in Phase 1 (see [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)). AI is a Phase 2 enhancement, introduced once the core job-search and posting experience is already working — this avoids promising a capability the first release doesn't have.
- **[CONFIRMED]** Organic traffic is the intended acquisition channel, but is not guaranteed. The architecture (see [10-seo-architecture.md](10-seo-architecture.md)) is built to make strong SEO possible; whether search engines actually rank and send traffic to the site is an outcome to measure (see [23-analytics-and-measurement.md](23-analytics-and-measurement.md)), not an assumption to build on.

## Problem being solved

- Candidates struggle to find genuinely relevant roles across fragmented, country-specific job boards.
- Employers struggle to reach qualified candidates and to triage applicant volume.
- Existing platforms are largely single-country or treat internationalization as an afterthought.

## Primary users

- **Candidates** — search and apply for jobs, manage a profile.
- **Employers** — post jobs, manage a company presence, review applicants.
- **Admins / internal operations** — moderate content, manage platform integrity, support users.

## Product pillars

1. **Job discovery** — SEO-first public job and company pages, usable without an account.
2. **Authorized, trustworthy content** — jobs come from direct, authorized employer self-service posting only; no third-party rewriting or unlicensed aggregation. See [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md).
3. **Employer tooling** — job posting and applicant management.
4. **Admin oversight** — moderation and platform integrity tooling.
5. **Multi-country by design** — the data model and routing account for multiple countries/markets from the start, even though initial launch covers a small number of them. See [05-multi-country-architecture.md](05-multi-country-architecture.md).
6. **AI-assisted matching (Phase 2)** — augment (not replace) search and applicant review with AI, added after core flows exist and only ever applied to legitimately-sourced content. See [08-ai-architecture.md](08-ai-architecture.md).

## Explicitly out of scope (for the platform generally, timing addressed in phasing doc)

- Not a general-purpose social/networking product.
- Not a payroll, HR, or contractor-payments system.
- Not (initially) a freelance/gig marketplace — a future direction, not a current one.
- Not a recruiting agency / staffing service — the platform connects, it does not act as an intermediary employer of record.

## Guiding principles

- **[CONFIRMED]** Ship as a single Next.js application; do not introduce a monorepo or microservices before there is a concrete need (see [03](03-application-architecture.md)).
- **[CONFIRMED]** Multi-country support is a day-one architectural concern, not a future migration.
- **[CONFIRMED]** Public SEO surfaces and authenticated dashboard surfaces are conceptually separate, even inside one app.
- **[RECOMMENDED]** Favor incremental delivery: a narrow, working MVP before AI or automation features (see [02](02-mvp-vs-future-phases.md)).
- **[RECOMMENDED]** Avoid infrastructure spend or complexity that isn't justified by current, real requirements.
